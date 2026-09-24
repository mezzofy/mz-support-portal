"""Integration tests — GraphQL end-to-end (HTTP → resolver → service → repo → Postgres).

Auto-skip unless SVC_SUPPORT_TEST_DATABASE_URL is set. Uses the dev-bypass
(X-Agent-Id, ENVIRONMENT=development) so no JWT is needed; the data path is real.
"""
import pytest
from ulid import ULID

from conftest import gql
from repositories.ticket_repository import TicketRepository

pytestmark = pytest.mark.integration

DEV_HEADERS = {"X-Agent-Id": "agent-x", "X-Agent-Team": "SUPPORT"}


def _seed(merchant_id="m_acme", status="OPEN"):
    return TicketRepository().create({
        "ticketId": str(ULID()), "merchantId": merchant_id, "userId": "u1",
        "type": "GENERAL", "status": status, "priority": "LOW",
        "subject": "Subject", "description": "A long-enough description.", "attachments": [],
    })


def test_support_tickets_query_returns_seeded(pg, client):
    _seed("m_acme")
    _seed("m_blue")
    q = "query { supportTickets(page:1, limit:20) { total tickets { ticketId merchantId merchantName status } } }"
    r = gql(client, q, headers=DEV_HEADERS)
    assert r.status_code == 200, r.text
    data = r.json()["data"]["supportTickets"]
    assert data["total"] == 2
    names = {t["merchantId"]: t["merchantName"] for t in data["tickets"]}
    assert names["m_acme"] == "Acme Retail"          # resolve-on-read
    assert names["m_blue"] == "Blue Sky Cafe"


def test_assign_ticket_mutation_auto_advances(pg, client):
    t = _seed("m_acme", status="OPEN")
    m = ("mutation($id:String!){ assignTicket(input:{ticketId:$id, assigneeId:\"agent-x\", "
         "assignedTeam:\"SUPPORT\"}) { ticketId assigneeId status } }")
    r = gql(client, m, headers=DEV_HEADERS, variables={"id": t["ticketId"]})
    assert r.status_code == 200, r.text
    out = r.json()["data"]["assignTicket"]
    assert out["assigneeId"] == "agent-x"
    assert out["status"] == "IN_PROGRESS"


def test_send_support_message_forces_support(pg, client):
    t = _seed("m_acme")
    m = ("mutation($id:String!){ sendSupportMessage(input:{ticketId:$id, content:\"On it.\"}) "
         "{ senderType senderId content } }")
    r = gql(client, m, headers=DEV_HEADERS, variables={"id": t["ticketId"]})
    assert r.status_code == 200, r.text
    msg = r.json()["data"]["sendSupportMessage"]
    assert msg["senderType"] == "SUPPORT"
    assert msg["senderId"] == "agent-x"      # forced from the acting agent


def test_illegal_status_transition_surfaces_error(pg, client):
    t = _seed("m_acme", status="OPEN")
    m = "mutation($id:String!){ updateTicketStatus(ticketId:$id, status:\"CLOSED\") { ticketId } }"
    r = gql(client, m, headers=DEV_HEADERS, variables={"id": t["ticketId"]})
    body = r.json()
    assert body.get("errors"), body            # OPEN → CLOSED is illegal
    assert "INVALID_STATUS_TRANSITION" in str(body["errors"])
