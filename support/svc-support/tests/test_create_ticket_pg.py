"""Integration tests — createSupportTicket (Option C staff intake) vs real Postgres.

Auto-skip unless SVC_SUPPORT_TEST_DATABASE_URL is set (conftest `pg`).
"""
import pytest

from conftest import gql
from services.support_ticket_service import SupportTicketService
from repositories.merchant_repository import MerchantRepository

pytestmark = pytest.mark.integration

DEV = {"X-Agent-Id": "agent-x", "X-Agent-Team": "SUPPORT"}


def test_service_create_ticket_upserts_merchant(pg):
    svc = SupportTicketService()
    out = svc.create_ticket(
        merchant_id="m_new", user_id="agent-x", ticket_type="BILLING",
        priority="HIGH", subject="Cannot pay", description="The invoice fails to load.",
        merchant_name="New Merchant",
    )
    assert out["merchantId"] == "m_new"
    assert out["merchantName"] == "New Merchant"     # resolve-on-read after upsert
    assert out["status"] == "OPEN"
    assert MerchantRepository().get_name("m_new") == "New Merchant"   # merchant row upserted
    items, total = svc.list_support_tickets(merchant_id="m_new")
    assert total == 1


def test_service_create_ticket_defaults_user_to_agent(pg):
    # no merchant_name → merchantName falls back to the id
    out = SupportTicketService().create_ticket(
        merchant_id="m_bare", user_id="agent-9", ticket_type="GENERAL",
        priority="LOW", subject="Question about hours", description="What are the store hours?",
    )
    assert out["merchantName"] == "m_bare"   # fallback
    assert out["userId"] == "agent-9"


def test_graphql_create_support_ticket(pg, client):
    m = ("mutation($in: CreateSupportTicketInput!){ createSupportTicket(input:$in) "
         "{ ticketId merchantId merchantName status type priority subject } }")
    v = {"in": {"merchantId": "m_new", "merchantName": "New Merchant", "type": "BILLING",
                "priority": "HIGH", "subject": "Cannot pay", "description": "The invoice fails to load."}}
    r = gql(client, m, headers=DEV, variables=v)
    assert r.status_code == 200, r.text
    t = r.json()["data"]["createSupportTicket"]
    assert t["merchantId"] == "m_new" and t["merchantName"] == "New Merchant"
    assert t["status"] == "OPEN" and t["type"] == "BILLING" and t["priority"] == "HIGH"
    # it now shows up in the cross-merchant queue filtered by the new merchant
    q = 'query { supportTickets(page:1,limit:20,filters:{merchantId:"m_new"}){ total } }'
    assert gql(client, q, headers=DEV).json()["data"]["supportTickets"]["total"] == 1


def test_graphql_create_validation_error(pg, client):
    m = "mutation($in: CreateSupportTicketInput!){ createSupportTicket(input:$in){ ticketId } }"
    v = {"in": {"merchantId": "m_x", "type": "GENERAL", "priority": "LOW",
                "subject": "ab", "description": "a long enough description"}}   # subject < 3
    body = gql(client, m, headers=DEV, variables=v).json()
    assert body.get("errors"), body
    assert "VALIDATION" in str(body["errors"]).upper() or "Subject" in str(body["errors"])
