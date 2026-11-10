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
from services.ticket_service import TicketService
from services.message_service import MessageService

logger = logging.getLogger(__name__)


class SupportTicketService:
    """General-usage support operations for authenticated agents."""

    def __init__(
        self,
        ticket_repo: Optional[TicketRepository] = None,
    ):
        self.ticket_repo = ticket_repo or TicketRepository()

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
        status: Optional[str] = None,
        type_: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[str] = None,
        unassigned: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Global ticket queue; returns (tickets, total)."""
        self._validate_filters(status, type_, priority)
        return self.ticket_repo.list_all_cross_merchant(
            page=page, limit=limit,
            status_filter=status, type_filter=type_, priority_filter=priority,
            assignee_id=assignee_id, unassigned=unassigned, search=search,
        )

    def list_my_assigned(
        self,
        agent_id: str,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        type_: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Convenience over ``list_support_tickets`` pinned to assignee = me."""
        return self.list_support_tickets(
            page=page, limit=limit, status=status,
            type_=type_, priority=priority, assignee_id=agent_id, search=search,
        )

    def get_support_ticket(self, ticket_id: str) -> Dict:
        """Single ticket by id."""
        return TicketService().get_ticket_by_id(ticket_id)

    def list_messages(self, ticket_id: str) -> List[Dict]:
        """All messages on a ticket, chronological."""
        return MessageService().list_messages(ticket_id)

    # ── mutations ────────────────────────────────────────────────────────

    def create_ticket(
        self,
        requestor_name: str,
        requestor_email: str,
        ticket_type: str,
        priority: str,
        subject: str,
        description: str,
        attachments: Optional[List[Dict]] = None,
    ) -> Dict:
        """Staff creates a general-usage ticket on behalf of a requestor.

        Reuses the vendored ``TicketService.create_ticket`` (type/priority/length/
        attachment validation, ULID, status=OPEN).
        """
        return TicketService().create_ticket(
            requestor_name=requestor_name,
            requestor_email=requestor_email,
            ticket_type=ticket_type,
            priority=priority,
            subject=subject,
            description=description,
            attachments=attachments,
        )

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
            ticket = TicketService().update_ticket_status(
                ticket_id, TICKET_STATUS_IN_PROGRESS
            )

        return ticket

    def update_status(self, ticket_id: str, status: str) -> Dict:
        """Transition status via the vendored state machine."""
        return TicketService().update_ticket_status(ticket_id, status)

    def send_support_message(
        self,
        ticket_id: str,
        agent_id: str,
        content: str,
        attachments: Optional[List[Dict]] = None,
    ) -> Dict:
        """Post a reply as SUPPORT. senderType/​senderId are forced server-side."""
        # Ensure the ticket exists (raises TicketNotFoundError otherwise).
        TicketService().get_ticket_by_id(ticket_id)
        return MessageService().send_message(
            ticket_id=ticket_id,
            sender_id=agent_id,           # forced: the acting agent
            content=content,
            sender_type=SENDER_TYPE_SUPPORT,  # forced SUPPORT
            attachments=attachments,
        )

    def mark_messages_as_read(self, ticket_id: str, user_id: str) -> int:
        """Mark messages not sent by ``user_id`` as read (staff opening a thread)."""
        return MessageService().mark_messages_as_read(ticket_id, user_id)
