"""GraphQL layer — drives the frozen SDL through strawberry's schema executor.

Covers the NEW resolvers/types/inputs and, crucially, the error contract the FE
relies on: GraphQL errors carry ``extensions.code`` (TICKET_NOT_FOUND,
VALIDATION_ERROR, INVALID_STATUS_TRANSITION) + ``extensions.status_code``.
"""
import pytest

from controllers.graphql.schema import schema
from controllers.graphql.context import SupportGraphQLContext
from auth.dependencies import SupportContext

SUPPORT_PERM = [{"resource": "SUPPORT_TICKETS", "actions": ["VIEW", "ADD", "EDIT", "APPROVE"]}]


def _ctx(agent_id="agent-1", team="SUPPORT"):
    agent = SupportContext(
        agent_id=agent_id, agent_name=f"{agent_id}@mezzofy.com",
        team=team, permissions=SUPPORT_PERM, session_id="sess-x",
    )
    return SupportGraphQLContext(agent=agent)


def _run(query, variables=None, ctx=None):
    return schema.execute_sync(
        query, variable_values=variables or {}, context_value=ctx or _ctx()
    )


# ── Queries ────────────────────────────────────────────────────────────────────

class TestQueries:
    def test_support_tickets_cross_merchant_with_pagination_envelope(self, platform):
        platform.merchant("merchant-A", "Acme")
        platform.ticket("t-a1", "merchant-A")
        platform.ticket("t-b1", "merchant-B")

        q = """
        query {
          supportTickets(page: 1, limit: 10) {
            total page limit
            tickets { ticketId merchantId merchantName status }
          }
        }
        """
        res = _run(q)
        assert res.errors is None, res.errors
        data = res.data["supportTickets"]
        assert data["total"] == 2
        assert data["page"] == 1 and data["limit"] == 10
        merchants = {t["merchantId"] for t in data["tickets"]}
        assert merchants == {"merchant-A", "merchant-B"}
        # merchantName resolved for A, falls back to id for B.
        names = {t["merchantId"]: t["merchantName"] for t in data["tickets"]}
        assert names["merchant-A"] == "Acme"
        assert names["merchant-B"] == "merchant-B"

    def test_support_tickets_filters_variable(self, platform):
        platform.ticket("t1", "merchant-A", status="OPEN")
        platform.ticket("t2", "merchant-B", status="RESOLVED")
        q = """
        query($f: SupportTicketFiltersInput) {
          supportTickets(filters: $f) { total tickets { ticketId } }
        }
        """
        res = _run(q, {"f": {"status": "RESOLVED"}})
        assert res.errors is None, res.errors
        assert res.data["supportTickets"]["total"] == 1
        assert res.data["supportTickets"]["tickets"][0]["ticketId"] == "t2"

    def test_support_ticket_by_id(self, platform):
        platform.merchant("merchant-A", "Acme")
        platform.ticket("t1", "merchant-A", subject="Broken QR")
        q = 'query { supportTicket(ticketId: "t1") { ticketId subject merchantName } }'
        res = _run(q)
        assert res.errors is None, res.errors
        assert res.data["supportTicket"]["subject"] == "Broken QR"
        assert res.data["supportTicket"]["merchantName"] == "Acme"

    def test_support_ticket_not_found_error_code(self, platform):
        res = _run('query { supportTicket(ticketId: "ghost") { ticketId } }')
        assert res.errors is not None
        assert res.errors[0].extensions["code"] == "TICKET_NOT_FOUND"
        assert res.errors[0].extensions["status_code"] == 404

    def test_my_assigned_pins_to_context_agent(self, platform):
        platform.ticket("t1", "merchant-A", assigneeId="agent-1")
        platform.ticket("t2", "merchant-B", assigneeId="agent-other")
        q = "query { myAssignedTickets { total tickets { ticketId assigneeId } } }"
        res = _run(q, ctx=_ctx(agent_id="agent-1"))
        assert res.errors is None, res.errors
        assert res.data["myAssignedTickets"]["total"] == 1
        assert res.data["myAssignedTickets"]["tickets"][0]["ticketId"] == "t1"

    def test_messages_query(self, platform):
        platform.ticket("t1", "merchant-A")
        platform.message("t1", "m1", sender_id="user-1", sender_type="USER", content="hi")
        q = 'query { messages(ticketId: "t1") { messageId senderType content isRead } }'
        res = _run(q)
        assert res.errors is None, res.errors
        msgs = res.data["messages"]
        assert len(msgs) == 1
        assert msgs[0]["senderType"] == "USER"

    def test_invalid_filter_status_maps_to_validation_error(self, platform):
        q = """
        query($f: SupportTicketFiltersInput) {
          supportTickets(filters: $f) { total tickets { ticketId } }
        }
        """
        res = _run(q, {"f": {"status": "BOGUS"}})
        assert res.errors is not None
        assert res.errors[0].extensions["code"] == "VALIDATION_ERROR"
        assert res.errors[0].extensions["status_code"] == 400


# ── Mutations ──────────────────────────────────────────────────────────────────

class TestMutations:
    def test_assign_auto_advances_and_defaults_team_from_context(self, platform):
        platform.ticket("t1", "merchant-A", status="OPEN")
        q = """
        mutation($in: AssignTicketInput!) {
          assignTicket(input: $in) {
            ticketId status assigneeId assignedTeam
          }
        }
        """
        # No assignedTeam in input → defaults to acting agent's team (FINANCE here).
        res = _run(q, {"in": {"ticketId": "t1", "assigneeId": "agent-1"}},
                   ctx=_ctx(team="FINANCE"))
        assert res.errors is None, res.errors
        t = res.data["assignTicket"]
        assert t["status"] == "IN_PROGRESS"       # OPEN auto-advanced
        assert t["assigneeId"] == "agent-1"
        assert t["assignedTeam"] == "FINANCE"

    def test_update_status_legal(self, platform):
        platform.ticket("t1", "merchant-A", status="IN_PROGRESS")
        q = 'mutation { updateTicketStatus(ticketId: "t1", status: "RESOLVED") { status } }'
        res = _run(q)
        assert res.errors is None, res.errors
        assert res.data["updateTicketStatus"]["status"] == "RESOLVED"

    def test_update_status_illegal_error_code(self, platform):
        platform.ticket("t1", "merchant-A", status="OPEN")
        q = 'mutation { updateTicketStatus(ticketId: "t1", status: "CLOSED") { status } }'
        res = _run(q)
        assert res.errors is not None
        assert res.errors[0].extensions["code"] == "INVALID_STATUS_TRANSITION"
        assert res.errors[0].extensions["status_code"] == 400

    def test_send_support_message_forces_sender(self, platform):
        platform.ticket("t1", "merchant-XYZ", status="IN_PROGRESS")
        q = """
        mutation($in: SendSupportMessageInput!) {
          sendSupportMessage(input: $in) { senderId senderType content }
        }
        """
        res = _run(q, {"in": {"ticketId": "t1", "content": "on it"}},
                   ctx=_ctx(agent_id="agent-42"))
        assert res.errors is None, res.errors
        m = res.data["sendSupportMessage"]
        assert m["senderType"] == "SUPPORT"
        assert m["senderId"] == "agent-42"

    def test_send_support_message_with_attachments(self, platform):
        platform.ticket("t1", "merchant-A", status="IN_PROGRESS")
        q = """
        mutation($in: SendSupportMessageInput!) {
          sendSupportMessage(input: $in) { content attachments { id fileName } }
        }
        """
        variables = {"in": {
            "ticketId": "t1", "content": "see file",
            "attachments": [{
                "id": "att-1", "fileName": "log.txt", "fileSize": 10,
                "fileType": "text/plain", "url": "https://x/y", "uploadedAt": "2026-09-18T00:00:00Z",
            }],
        }}
        res = _run(q, variables)
        assert res.errors is None, res.errors
        att = res.data["sendSupportMessage"]["attachments"]
        assert att[0]["id"] == "att-1"
        assert att[0]["fileName"] == "log.txt"

    def test_mark_messages_as_read(self, platform):
        platform.ticket("t1", "merchant-A")
        platform.message("t1", "m1", sender_id="user-1", sender_type="USER", isRead=False)
        q = 'mutation { markMessagesAsRead(ticketId: "t1", userId: "agent-1") { message } }'
        res = _run(q)
        assert res.errors is None, res.errors
        assert "1 message" in res.data["markMessagesAsRead"]["message"]
