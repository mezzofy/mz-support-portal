"""SupportTicketService — cross-merchant queue, assign, status machine, replies.

Exercises the NEW support-console orchestration (the code CR-support-console
added on top of the vendored svc-tickets services) against a moto platform table.
"""
import pytest

from services.support_ticket_service import SupportTicketService
from core.errors import (
    InvalidStatusTransitionError,
    ValidationError,
    TicketNotFoundError,
)


@pytest.fixture
def svc():
    return SupportTicketService()


# ── Cross-merchant list ────────────────────────────────────────────────────────

class TestCrossMerchantList:
    def test_returns_tickets_from_multiple_merchants(self, platform, svc):
        """The whole point of the console: the per-merchant filter is dropped."""
        platform.ticket("t-a1", "merchant-A")
        platform.ticket("t-b1", "merchant-B")
        platform.ticket("t-c1", "merchant-C")

        tickets, total = svc.list_support_tickets()

        assert total == 3
        merchants = {t["merchantId"] for t in tickets}
        assert merchants == {"merchant-A", "merchant-B", "merchant-C"}
        assert len(merchants) > 1  # explicitly: cross-merchant visibility

    def test_filter_by_merchant_id_narrows(self, platform, svc):
        platform.ticket("t-a1", "merchant-A")
        platform.ticket("t-a2", "merchant-A")
        platform.ticket("t-b1", "merchant-B")

        tickets, total = svc.list_support_tickets(merchant_id="merchant-A")

        assert total == 2
        assert {t["merchantId"] for t in tickets} == {"merchant-A"}

    def test_filter_by_status(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="OPEN")
        platform.ticket("t2", "merchant-B", status="RESOLVED")

        tickets, total = svc.list_support_tickets(status="RESOLVED")
        assert total == 1
        assert tickets[0]["ticketId"] == "t2"

    def test_filter_by_type(self, platform, svc):
        platform.ticket("t1", "merchant-A", type="BILLING")
        platform.ticket("t2", "merchant-B", type="TECHNICAL")

        tickets, total = svc.list_support_tickets(type_="BILLING")
        assert total == 1
        assert tickets[0]["type"] == "BILLING"

    def test_filter_by_priority(self, platform, svc):
        platform.ticket("t1", "merchant-A", priority="URGENT")
        platform.ticket("t2", "merchant-B", priority="LOW")

        tickets, total = svc.list_support_tickets(priority="URGENT")
        assert total == 1
        assert tickets[0]["priority"] == "URGENT"

    def test_filter_by_assignee_id(self, platform, svc):
        platform.ticket("t1", "merchant-A", assigneeId="agent-1")
        platform.ticket("t2", "merchant-B", assigneeId="agent-2")
        platform.ticket("t3", "merchant-C")  # unassigned

        tickets, total = svc.list_support_tickets(assignee_id="agent-1")
        assert total == 1
        assert tickets[0]["ticketId"] == "t1"

    def test_filter_unassigned(self, platform, svc):
        platform.ticket("t1", "merchant-A", assigneeId="agent-1")
        platform.ticket("t2", "merchant-B")  # unassigned
        platform.ticket("t3", "merchant-C")  # unassigned

        tickets, total = svc.list_support_tickets(unassigned=True)
        assert total == 2
        assert all(not t.get("assigneeId") for t in tickets)

    def test_search_matches_subject_description_and_merchant(self, platform, svc):
        platform.ticket("t1", "merchant-A", subject="Refund not received")
        platform.ticket("t2", "merchant-B", description="please issue a REFUND")
        platform.ticket("t3", "merchant-refundco", subject="unrelated")
        platform.ticket("t4", "merchant-Z", subject="nothing here", description="all good")

        tickets, total = svc.list_support_tickets(search="refund")
        ids = {t["ticketId"] for t in tickets}
        assert total == 3
        assert ids == {"t1", "t2", "t3"}

    def test_invalid_status_filter_raises_validation_error(self, platform, svc):
        with pytest.raises(ValidationError):
            svc.list_support_tickets(status="BOGUS")


# ── Pagination ─────────────────────────────────────────────────────────────────

class TestPagination:
    def test_total_is_full_match_page_is_slice(self, platform, svc):
        for i in range(5):
            platform.ticket(f"t{i}", "merchant-A", status="OPEN")

        page1, total1 = svc.list_support_tickets(page=1, limit=2)
        page2, total2 = svc.list_support_tickets(page=2, limit=2)
        page3, total3 = svc.list_support_tickets(page=3, limit=2)

        assert total1 == total2 == total3 == 5
        assert len(page1) == 2
        assert len(page2) == 2
        assert len(page3) == 1  # remainder

        # Pages are disjoint and cover everything.
        seen = {t["ticketId"] for t in page1 + page2 + page3}
        assert len(seen) == 5


# ── My-assigned ────────────────────────────────────────────────────────────────

class TestMyAssigned:
    def test_pins_to_agent_and_ignores_assignee_filter(self, platform, svc):
        platform.ticket("t1", "merchant-A", assigneeId="agent-me")
        platform.ticket("t2", "merchant-B", assigneeId="agent-other")

        tickets, total = svc.list_my_assigned(agent_id="agent-me")
        assert total == 1
        assert tickets[0]["ticketId"] == "t1"


# ── Assign ─────────────────────────────────────────────────────────────────────

class TestAssign:
    def test_assign_writes_all_assignment_attrs(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="IN_PROGRESS")

        result = svc.assign_ticket(
            ticket_id="t1", assignee_id="agent-1",
            assignee_name="Alice", assigned_team="SUPPORT",
        )

        assert result["assigneeId"] == "agent-1"
        assert result["assigneeName"] == "Alice"
        assert result["assignedTeam"] == "SUPPORT"
        assert result["assignedAt"]  # timestamp written

    def test_assigned_team_defaults_to_acting_agent_team(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="IN_PROGRESS")

        result = svc.assign_ticket(
            ticket_id="t1", assignee_id="agent-1", default_team="SALES",
        )
        assert result["assignedTeam"] == "SALES"

    def test_first_assign_on_open_auto_advances_to_in_progress(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="OPEN")

        result = svc.assign_ticket(ticket_id="t1", assignee_id="agent-1")

        assert result["status"] == "IN_PROGRESS"
        assert result["assigneeId"] == "agent-1"

    def test_assign_non_open_ticket_keeps_status(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="PENDING_USER")

        result = svc.assign_ticket(ticket_id="t1", assignee_id="agent-1")
        assert result["status"] == "PENDING_USER"

    def test_assign_invalid_team_raises(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="OPEN")
        with pytest.raises(ValidationError):
            svc.assign_ticket(ticket_id="t1", assignee_id="agent-1", assigned_team="MARKETING")

    def test_assign_missing_ticket_raises(self, platform, svc):
        with pytest.raises(TicketNotFoundError):
            svc.assign_ticket(ticket_id="nope", assignee_id="agent-1")


# ── Status machine ─────────────────────────────────────────────────────────────

class TestStatusMachine:
    @pytest.mark.parametrize("start,target", [
        ("OPEN", "IN_PROGRESS"),
        ("OPEN", "CANCELLED"),
        ("IN_PROGRESS", "PENDING_USER"),
        ("IN_PROGRESS", "PENDING_MERCHANT"),
        ("IN_PROGRESS", "RESOLVED"),
        ("PENDING_USER", "IN_PROGRESS"),
        ("PENDING_MERCHANT", "RESOLVED"),
        ("RESOLVED", "CLOSED"),
        ("RESOLVED", "IN_PROGRESS"),  # reopen
    ])
    def test_legal_transitions_accepted(self, platform, svc, start, target):
        platform.ticket("t1", "merchant-A", status=start)
        result = svc.update_status("t1", target)
        assert result["status"] == target

    @pytest.mark.parametrize("start,target", [
        ("OPEN", "RESOLVED"),
        ("OPEN", "CLOSED"),
        ("IN_PROGRESS", "CLOSED"),
        ("RESOLVED", "CANCELLED"),
        ("CLOSED", "IN_PROGRESS"),      # terminal
        ("CANCELLED", "IN_PROGRESS"),   # terminal
        ("PENDING_USER", "PENDING_MERCHANT"),
    ])
    def test_illegal_transitions_rejected(self, platform, svc, start, target):
        platform.ticket("t1", "merchant-A", status=start)
        with pytest.raises(InvalidStatusTransitionError):
            svc.update_status("t1", target)

    def test_closing_stamps_closed_at(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="RESOLVED")
        result = svc.update_status("t1", "CLOSED")
        assert result["status"] == "CLOSED"
        assert result.get("closedAt")

    def test_invalid_status_value_raises_validation(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="OPEN")
        with pytest.raises(ValidationError):
            svc.update_status("t1", "NONSENSE")


# ── Support reply + read receipts ──────────────────────────────────────────────

class TestSupportReply:
    def test_reply_forces_support_sender_and_ticket_merchant(self, platform, svc):
        platform.ticket("t1", "merchant-XYZ", status="IN_PROGRESS")

        msg = svc.send_support_message(
            ticket_id="t1", agent_id="agent-77", content="We're on it.",
        )

        assert msg["senderType"] == "SUPPORT"
        assert msg["senderId"] == "agent-77"
        # Stored under the ticket's own merchant so the merchant web-tickets view shows it.
        assert msg["merchantId"] == "merchant-XYZ"
        assert msg["content"] == "We're on it."

    def test_reply_on_missing_ticket_raises(self, platform, svc):
        with pytest.raises(TicketNotFoundError):
            svc.send_support_message(ticket_id="ghost", agent_id="a1", content="hi")

    def test_mark_read_marks_only_the_other_sides_messages(self, platform, svc):
        platform.ticket("t1", "merchant-A", status="IN_PROGRESS")
        # USER-side message (unread) + a SUPPORT message from the acting agent (unread).
        platform.message("t1", "m-user", sender_id="user-cust-1", sender_type="USER", isRead=False)
        platform.message("t1", "m-supp", sender_id="agent-me", sender_type="SUPPORT", isRead=False)

        count = svc.mark_messages_as_read("t1", user_id="agent-me")
        assert count == 1  # only the USER message flips

        msgs = {m["messageId"]: m for m in svc.list_messages("t1")}
        assert msgs["m-user"]["isRead"] is True
        assert msgs["m-supp"]["isRead"] is False


# ── merchantName resolve-on-read (R-7) ─────────────────────────────────────────

class TestMerchantNameResolve:
    def test_resolves_name_from_merchant_item(self, platform, svc):
        platform.merchant("merchant-A", "Acme Coffee Co")
        platform.ticket("t1", "merchant-A")

        tickets, _ = svc.list_support_tickets()
        assert tickets[0]["merchantName"] == "Acme Coffee Co"

    def test_falls_back_to_merchant_id_when_name_absent(self, platform, svc):
        # No MERCHANT# item seeded → must fall back to the raw id, never null.
        platform.ticket("t1", "merchant-unknown")

        tickets, _ = svc.list_support_tickets()
        assert tickets[0]["merchantName"] == "merchant-unknown"
        assert tickets[0]["merchantName"] is not None

    def test_single_ticket_read_resolves_name(self, platform, svc):
        platform.merchant("merchant-A", "Acme Coffee Co")
        platform.ticket("t1", "merchant-A")

        result = svc.get_support_ticket("t1")
        assert result["merchantName"] == "Acme Coffee Co"

    def test_single_ticket_missing_raises(self, platform, svc):
        with pytest.raises(TicketNotFoundError):
            svc.get_support_ticket("nope")
