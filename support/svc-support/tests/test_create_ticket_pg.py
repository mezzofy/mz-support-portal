"""Integration tests — createSupportTicket (staff intake) vs real Postgres.

Auto-skip unless SVC_SUPPORT_TEST_DATABASE_URL is set (conftest `pg`).
General-usage schema (requestor, no merchant).
"""
import pytest

from conftest import gql
from services.support_ticket_service import SupportTicketService

pytestmark = pytest.mark.integration

DEV = {"X-Agent-Id": "agent-x", "X-Agent-Team": "SUPPORT"}


def test_service_create_ticket_persists_requestor(pg):
    svc = SupportTicketService()
    out = svc.create_ticket(
        requestor_name="New Requestor", requestor_email="new@example.com", ticket_type="BILLING",
        priority="HIGH", subject="Cannot pay", description="The invoice fails to load.",
    )
    assert out["requestorName"] == "New Requestor"
    assert out["requestorEmail"] == "new@example.com"
    assert out["status"] == "OPEN"
    items, total = svc.list_support_tickets()
    assert total == 1


def test_service_create_ticket_general_type(pg):
    out = SupportTicketService().create_ticket(
        requestor_name="Bare Requestor", requestor_email="bare@example.com", ticket_type="HR",
        priority="LOW", subject="Question about leave", description="How many days of annual leave do I have?",
    )
    assert out["type"] == "HR"
    assert out["requestorEmail"] == "bare@example.com"


def test_graphql_create_support_ticket(pg, client):
    m = ("mutation($in: CreateSupportTicketInput!){ createSupportTicket(input:$in) "
         "{ ticketId requestorName requestorEmail status type priority subject } }")
    v = {"in": {"requestorName": "New Requestor", "requestorEmail": "new@example.com", "type": "BILLING",
                "priority": "HIGH", "subject": "Cannot pay", "description": "The invoice fails to load."}}
    r = gql(client, m, headers=DEV, variables=v)
    assert r.status_code == 200, r.text
    t = r.json()["data"]["createSupportTicket"]
    assert t["requestorName"] == "New Requestor" and t["requestorEmail"] == "new@example.com"
    assert t["status"] == "OPEN" and t["type"] == "BILLING" and t["priority"] == "HIGH"
    # it now shows up in the queue
    q = 'query { supportTickets(page:1,limit:20){ total } }'
    assert gql(client, q, headers=DEV).json()["data"]["supportTickets"]["total"] == 1


def test_graphql_create_validation_error(pg, client):
    m = "mutation($in: CreateSupportTicketInput!){ createSupportTicket(input:$in){ ticketId } }"
    v = {"in": {"requestorName": "X", "requestorEmail": "x@example.com", "type": "GENERAL", "priority": "LOW",
                "subject": "ab", "description": "a long enough description"}}   # subject < 3
    body = gql(client, m, headers=DEV, variables=v).json()
    assert body.get("errors"), body
    assert "VALIDATION" in str(body["errors"]).upper() or "Subject" in str(body["errors"])
