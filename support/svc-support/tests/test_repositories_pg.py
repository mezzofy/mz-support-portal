"""Integration tests — repositories against a real Postgres (Option B).

Auto-skip unless SVC_SUPPORT_TEST_DATABASE_URL is set (see conftest `pg`).
Exercises real SQL: JSONB attachments, ILIKE search, ANY(), RETURNING, FK cascade,
camelCase mapper, sparse-attr omission.
"""
import pytest
from ulid import ULID

from repositories.ticket_repository import TicketRepository
from repositories.message_repository import MessageRepository
from repositories.merchant_repository import MerchantRepository
from core.errors import TicketNotFoundError

pytestmark = pytest.mark.integration


def _ticket(merchant_id="m_acme", **over):
    d = {
        "ticketId": str(ULID()),
        "merchantId": merchant_id,
        "userId": "u1",
        "type": "GENERAL",
        "status": "OPEN",
        "priority": "LOW",
        "subject": "Subject line",
        "description": "A description that is long enough.",
        "attachments": [],
    }
    d.update(over)
    return d


# ── tickets ────────────────────────────────────────────────────────────────────

def test_create_and_get_roundtrip(pg):
    repo = TicketRepository()
    att = [{"id": "a1", "fileName": "x.pdf", "fileSize": 10, "fileType": "application/pdf",
            "url": "http://x", "uploadedAt": "2026-01-01T00:00:00+00:00"}]
    created = repo.create(_ticket(attachments=att))
    got = repo.get_by_id(created["ticketId"])
    assert got["ticketId"] == created["ticketId"]
    assert got["merchantId"] == "m_acme"
    assert got["attachments"] == att            # JSONB round-trips
    assert got["createdAt"].endswith("+00:00")  # ISO string, tz-aware
    # unassigned ticket omits the sparse fields entirely
    assert "assigneeId" not in got and "assignedAt" not in got and "closedAt" not in got


def test_get_missing_returns_none(pg):
    assert TicketRepository().get_by_id(str(ULID())) is None


def test_cross_merchant_list_filters_and_pagination(pg):
    repo = TicketRepository()
    repo.create(_ticket("m_acme", status="OPEN", priority="HIGH", type="BILLING", subject="refund needed"))
    repo.create(_ticket("m_blue", status="IN_PROGRESS", priority="LOW", type="TECHNICAL", subject="scanner"))
    repo.create(_ticket("m_acme", status="OPEN", priority="URGENT", type="GENERAL", subject="hello"))

    items, total = repo.list_all_cross_merchant(page=1, limit=20)
    assert total == 3 and len(items) == 3

    items, total = repo.list_all_cross_merchant(merchant_id="m_acme")
    assert total == 2 and all(t["merchantId"] == "m_acme" for t in items)

    items, total = repo.list_all_cross_merchant(status_filter="OPEN")
    assert total == 2
    items, total = repo.list_all_cross_merchant(type_filter="TECHNICAL")
    assert total == 1 and items[0]["merchantId"] == "m_blue"

    # case-insensitive search over subject
    items, total = repo.list_all_cross_merchant(search="REFUND")
    assert total == 1 and "refund" in items[0]["subject"].lower()

    # pagination
    _, total = repo.list_all_cross_merchant(page=1, limit=2)
    page2, total2 = repo.list_all_cross_merchant(page=2, limit=2)
    assert total == 3 and total2 == 3 and len(page2) == 1


def test_unassigned_and_assignee_filters(pg):
    repo = TicketRepository()
    a = repo.create(_ticket("m_acme"))
    repo.create(_ticket("m_blue"))
    repo.assign(a["ticketId"], assignee_id="agent-x", assignee_name="X", assigned_team="SUPPORT")

    items, total = repo.list_all_cross_merchant(unassigned=True)
    assert total == 1 and items[0]["ticketId"] != a["ticketId"]

    items, total = repo.list_all_cross_merchant(assignee_id="agent-x")
    assert total == 1 and items[0]["ticketId"] == a["ticketId"]


def test_update_sets_updated_at_and_returns_full_row(pg):
    repo = TicketRepository()
    t = repo.create(_ticket())
    updated = repo.update(t["ticketId"], {"status": "IN_PROGRESS"})
    assert updated["status"] == "IN_PROGRESS"
    assert updated["updatedAt"] >= t["updatedAt"]


def test_update_missing_raises(pg):
    with pytest.raises(TicketNotFoundError):
        TicketRepository().update(str(ULID()), {"status": "IN_PROGRESS"})


def test_assign_writes_sparse_attrs(pg):
    repo = TicketRepository()
    t = repo.create(_ticket())
    out = repo.assign(t["ticketId"], assignee_id="agent-x", assignee_name="Agent X", assigned_team="SUPPORT")
    assert out["assigneeId"] == "agent-x"
    assert out["assigneeName"] == "Agent X"
    assert out["assignedTeam"] == "SUPPORT"
    assert out["assignedAt"].endswith("+00:00")


def test_delete_cascades_messages(pg):
    trepo, mrepo = TicketRepository(), MessageRepository("m_acme")
    t = trepo.create(_ticket())
    mrepo.create({"messageId": str(ULID()), "ticketId": t["ticketId"], "merchantId": "m_acme",
                  "senderId": "u1", "senderType": "USER", "content": "hi", "attachments": []})
    trepo.delete(t["ticketId"])
    assert trepo.get_by_id(t["ticketId"]) is None
    assert mrepo.list_by_ticket(t["ticketId"]) == []   # FK ON DELETE CASCADE


# ── messages ─────────────────────────────────────────────────────────────────

def test_messages_create_list_chronological(pg):
    trepo, mrepo = TicketRepository(), MessageRepository("m_acme")
    t = trepo.create(_ticket())
    for i, stype in enumerate(["USER", "SUPPORT", "USER"]):
        mrepo.create({"messageId": str(ULID()), "ticketId": t["ticketId"], "merchantId": "m_acme",
                      "senderId": "s%d" % i, "senderType": stype, "content": "m%d" % i, "attachments": []})
    msgs = mrepo.list_by_ticket(t["ticketId"])
    assert [m["content"] for m in msgs] == ["m0", "m1", "m2"]     # oldest-first
    assert msgs[0]["isRead"] is False and msgs[1]["senderType"] == "SUPPORT"


def test_mark_all_as_read_for_user_flips_other_side_only(pg):
    trepo, mrepo = TicketRepository(), MessageRepository("m_acme")
    t = trepo.create(_ticket())
    mrepo.create({"messageId": str(ULID()), "ticketId": t["ticketId"], "merchantId": "m_acme",
                  "senderId": "merchant-user", "senderType": "USER", "content": "q", "attachments": []})
    mrepo.create({"messageId": str(ULID()), "ticketId": t["ticketId"], "merchantId": "m_acme",
                  "senderId": "agent-x", "senderType": "SUPPORT", "content": "a", "attachments": []})
    # agent opens the thread → marks messages NOT sent by the agent
    n = mrepo.mark_all_as_read_for_user(t["ticketId"], "agent-x")
    assert n == 1
    msgs = {m["senderId"]: m["isRead"] for m in mrepo.list_by_ticket(t["ticketId"])}
    assert msgs["merchant-user"] is True and msgs["agent-x"] is False


# ── merchants ────────────────────────────────────────────────────────────────

def test_merchant_get_name(pg):
    repo = MerchantRepository()
    assert repo.get_name("m_acme") == "Acme Retail"
    assert repo.get_name("m_missing") is None
    assert repo.get_name("") is None
