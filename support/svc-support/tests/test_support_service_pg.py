"""Integration tests — SupportTicketService orchestration against real Postgres.

Auto-skip unless SVC_SUPPORT_TEST_DATABASE_URL is set (see conftest `pg`).
Verifies the general-usage support operations (requestor, no merchant).
"""
import pytest
from ulid import ULID

from repositories.ticket_repository import TicketRepository
from repositories.message_repository import MessageRepository
from services.support_ticket_service import SupportTicketService
from core.errors import InvalidStatusTransitionError

pytestmark = pytest.mark.integration


def _seed_ticket(requestor_email="alice@acme.com", **over):
    d = {
        "ticketId": str(ULID()), "requestorName": "Alice Tan", "requestorEmail": requestor_email,
        "type": "GENERAL", "status": "OPEN", "priority": "LOW",
        "subject": "Subject", "description": "A long-enough description.", "attachments": [],
    }
    d.update(over)
    return TicketRepository().create(d)


def test_list_returns_requestor(pg):
    _seed_ticket("alice@acme.com")
    _seed_ticket("bob@blue.com")
    svc = SupportTicketService()
    items, total = svc.list_support_tickets()
    assert total == 2
    emails = {t["requestorEmail"] for t in items}
    assert emails == {"alice@acme.com", "bob@blue.com"}


def test_get_support_ticket(pg):
    t = _seed_ticket("carol@blue.com")
    got = SupportTicketService().get_support_ticket(t["ticketId"])
    assert got["requestorEmail"] == "carol@blue.com"


def test_assign_writes_attrs_and_auto_advances_open(pg):
    t = _seed_ticket(status="OPEN")
    out = SupportTicketService().assign_ticket(
        t["ticketId"], assignee_id="agent-x", assignee_name="Agent X", default_team="SUPPORT"
    )
    assert out["assigneeId"] == "agent-x"
    assert out["assignedTeam"] == "SUPPORT"
    assert out["status"] == "IN_PROGRESS"       # OPEN → IN_PROGRESS on first assign


def test_assign_does_not_advance_non_open(pg):
    t = _seed_ticket(status="PENDING_USER")
    out = SupportTicketService().assign_ticket(t["ticketId"], assignee_id="agent-x", default_team="SUPPORT")
    assert out["status"] == "PENDING_USER"      # unchanged


def test_update_status_legal_transition(pg):
    t = _seed_ticket(status="OPEN")
    out = SupportTicketService().update_status(t["ticketId"], "IN_PROGRESS")
    assert out["status"] == "IN_PROGRESS"


def test_update_status_illegal_transition_raises(pg):
    t = _seed_ticket(status="OPEN")
    with pytest.raises(InvalidStatusTransitionError):
        SupportTicketService().update_status(t["ticketId"], "CLOSED")   # OPEN cannot → CLOSED


def test_update_status_closed_sets_closed_at(pg):
    t = _seed_ticket(status="RESOLVED")
    out = SupportTicketService().update_status(t["ticketId"], "CLOSED")
    assert out["status"] == "CLOSED"
    assert out.get("closedAt", "").endswith("+00:00")


def test_send_support_message_forces_support_sender(pg):
    t = _seed_ticket()
    msg = SupportTicketService().send_support_message(t["ticketId"], agent_id="agent-x", content="On it.")
    assert msg["senderType"] == "SUPPORT"       # forced
    assert msg["senderId"] == "agent-x"
    stored = MessageRepository().list_by_ticket(t["ticketId"])
    assert len(stored) == 1 and stored[0]["senderType"] == "SUPPORT"


def test_mark_messages_as_read(pg):
    t = _seed_ticket()
    mrepo = MessageRepository()
    mrepo.create({"messageId": str(ULID()), "ticketId": t["ticketId"],
                  "senderId": "requestor-user", "senderType": "USER", "content": "q", "attachments": []})
    n = SupportTicketService().mark_messages_as_read(t["ticketId"], "agent-x")
    assert n == 1
