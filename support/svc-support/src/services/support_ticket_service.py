"""Support-console orchestration service (NEW — the cross-merchant agent logic).

Sits on top of the vendored TicketService / MessageService and the extended
TicketRepository. Responsibilities:
  * cross-merchant queue + "my assigned" listing (GSI2 + in-memory refine);
  * assignment (sparse attrs) with optional OPEN→IN_PROGRESS auto-advance;
  * status transitions (reusing the vendored state machine);
  * SUPPORT replies (senderType forced SUPPORT, senderId = agent);
  * resolve-on-read of ``merchantName`` (R-7) from the MERCHANT# item.
"""
import logging
from typing import Dict, List, Optional, Tuple

from core.errors import ValidationError
from core.utils.constants import (
    VALID_TICKET_STATUSES, VALID_TICKET_TYPES, VALID_PRIORITIES, VALID_STAFF_TEAMS,
    TICKET_STATUS_OPEN, TICKET_STATUS_IN_PROGRESS, SENDER_TYPE_SUPPORT,
)
from repositories.ticket_repository import TicketRepository
from repositories.message_repository import MessageRepository
from repositories.merchant_repository import MerchantRepository
from services.ticket_service import TicketService
from services.message_service import MessageService

logger = logging.getLogger(__name__)


class SupportTicketService:
    """Cross-merchant support operations for authenticated agents."""

    def __init__(
        self,
        ticket_repo: Optional[TicketRepository] = None,
        merchant_repo: Optional[MerchantRepository] = None,
    ):
        self.ticket_repo = ticket_repo or TicketRepository()
        self.merchant_repo = merchant_repo or MerchantRepository()

    # ── merchantName resolve-on-read (R-7) ──────────────────────────────

    def _attach_merchant_name(self, ticket: Dict, cache: Dict[str, Optional[str]]) -> Dict:
        """Return a copy of ``ticket`` with a resolved ``merchantName`` field.

        Falls back to the merchantId when the merchant record has no name /
        isn't found, so the field is never empty for the UI.
        """
        merchant_id = ticket.get('merchantId', '')
        if merchant_id not in cache:
            cache[merchant_id] = self.merchant_repo.get_name(merchant_id)
        name = cache[merchant_id] or merchant_id  # fallback → merchantId (TODO: GSI/denormalize)
        return {**ticket, 'merchantName': name}

    def _attach_names(self, tickets: List[Dict]) -> List[Dict]:
        cache: Dict[str, Optional[str]] = {}
        return [self._attach_merchant_name(t, cache) for t in tickets]

    # ── validation helpers ──────────────────────────────────────────────

    @staticmethod
    def _validate_filters(status, type_, priority) -> None:
        if status and status not in VALID_TICKET_STATUSES:
            raise ValidationError(f"Invalid status: {status}", "status")
        if type_ and type_ not in VALID_TICKET_TYPES:
            raise ValidationError(f"Invalid type: {type_}", "type")
        if priority and priority not in VALID_PRIORITIES:
            raise ValidationError(f"Invalid priority: {priority}", "priority")

    # ── queries ─────────────────────────────────────────────────────────

    def list_support_tickets(
        self,
        page: int = 1,
        limit: int = 20,
        merchant_id: Optional[str] = None,
        status: Optional[str] = None,
        type_: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[str] = None,
        unassigned: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Cross-merchant queue with in-memory refine; returns (tickets, total)."""
        self._validate_filters(status, type_, priority)
        items, total = self.ticket_repo.list_all_cross_merchant(
            page=page, limit=limit, merchant_id=merchant_id,
            status_filter=status, type_filter=type_, priority_filter=priority,
            assignee_id=assignee_id, unassigned=unassigned, search=search,
        )
        return self._attach_names(items), total

    def list_my_assigned(
        self,
        agent_id: str,
        page: int = 1,
        limit: int = 20,
        merchant_id: Optional[str] = None,
        status: Optional[str] = None,
        type_: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Convenience over ``list_support_tickets`` pinned to assignee = me."""
        return self.list_support_tickets(
            page=page, limit=limit, merchant_id=merchant_id, status=status,
            type_=type_, priority=priority, assignee_id=agent_id, search=search,
        )

    def get_support_ticket(self, ticket_id: str) -> Dict:
        """Single ticket (any merchant) with resolved merchantName."""
        ticket = TicketService(merchant_id="").get_ticket_by_id(ticket_id)
        return self._attach_merchant_name(ticket, {})

    def list_messages(self, ticket_id: str) -> List[Dict]:
        """All messages on a ticket, chronological."""
        return MessageService(merchant_id="").list_messages(ticket_id)

    # ── mutations ────────────────────────────────────────────────────────

    def assign_ticket(
        self,
        ticket_id: str,
        assignee_id: str,
        assignee_name: Optional[str] = None,
        assigned_team: Optional[str] = None,
        default_team: Optional[str] = None,
    ) -> Dict:
        """Assign a ticket to an agent; auto-advance OPEN→IN_PROGRESS.

        ``assigned_team`` defaults to the acting agent's team (``default_team``)
        when the caller does not pass one.
        """
        team = assigned_team or default_team
        if team and team not in VALID_STAFF_TEAMS:
            raise ValidationError(f"Invalid team: {team}", "assignedTeam")

        # Validates the ticket exists via repo.update → TicketNotFoundError.
        ticket = self.ticket_repo.assign(
            ticket_id=ticket_id,
            assignee_id=assignee_id,
            assignee_name=assignee_name,
            assigned_team=team,
        )

        # Auto-advance a brand-new OPEN ticket into IN_PROGRESS on first assign.
        if ticket.get('status') == TICKET_STATUS_OPEN:
            ticket = TicketService(merchant_id="").update_ticket_status(
                ticket_id, TICKET_STATUS_IN_PROGRESS
            )

        return self._attach_merchant_name(ticket, {})

    def update_status(self, ticket_id: str, status: str) -> Dict:
        """Transition status via the vendored state machine."""
        ticket = TicketService(merchant_id="").update_ticket_status(ticket_id, status)
        return self._attach_merchant_name(ticket, {})

    def send_support_message(
        self,
        ticket_id: str,
        agent_id: str,
        content: str,
        attachments: Optional[List[Dict]] = None,
    ) -> Dict:
        """Post a reply as SUPPORT. senderType/​senderId are forced server-side.

        The message is stored with the *ticket's own* merchantId so the merchant
        view renders it correctly.
        """
        ticket = TicketService(merchant_id="").get_ticket_by_id(ticket_id)
        merchant_id = ticket.get('merchantId', '')
        service = MessageService(merchant_id=merchant_id)
        return service.send_message(
            ticket_id=ticket_id,
            sender_id=agent_id,           # forced: the acting agent
            content=content,
            sender_type=SENDER_TYPE_SUPPORT,  # forced SUPPORT
            attachments=attachments,
        )

    def mark_messages_as_read(self, ticket_id: str, user_id: str) -> int:
        """Mark messages not sent by ``user_id`` as read (staff opening a thread)."""
        return MessageService(merchant_id="").mark_messages_as_read(ticket_id, user_id)
