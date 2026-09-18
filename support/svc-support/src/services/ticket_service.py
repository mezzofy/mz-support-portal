"""Ticket service — business logic, validation, status transitions.

VENDORED UNCHANGED from svc-tickets. The support console reuses
``update_ticket_status`` (state machine) and ``get_ticket_by_id`` via
SupportTicketService; ``merchant_id`` is irrelevant to those two paths because
the underlying repo keys tickets by ticketId alone.
"""
import logging
from typing import Dict, List, Optional, Tuple

from ulid import ULID

from core.config import settings
from core.errors import (
    TicketNotFoundError,
    ValidationError,
    InvalidStatusTransitionError,
    TooManyAttachmentsError,
)
from core.utils.constants import (
    VALID_TICKET_TYPES,
    VALID_PRIORITIES,
    VALID_TICKET_STATUSES,
    STATUS_TRANSITIONS,
    TICKET_STATUS_OPEN,
    TICKET_STATUS_CANCELLED,
)
from repositories.ticket_repository import TicketRepository

logger = logging.getLogger(__name__)


class TicketService:
    """Business logic for ticket CRUD and status management."""

    def __init__(
        self,
        merchant_id: str,
        ticket_repo: Optional[TicketRepository] = None,
    ):
        self.merchant_id = merchant_id
        self.ticket_repo = ticket_repo or TicketRepository(merchant_id)

    def list_tickets(
        self,
        page: int = 1,
        limit: int = 20,
        status_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """List tickets with optional filters and pagination."""
        if status_filter and status_filter not in VALID_TICKET_STATUSES:
            raise ValidationError(f"Invalid status: {status_filter}", "status")
        if type_filter and type_filter not in VALID_TICKET_TYPES:
            raise ValidationError(f"Invalid type: {type_filter}", "type")
        if priority_filter and priority_filter not in VALID_PRIORITIES:
            raise ValidationError(f"Invalid priority: {priority_filter}", "priority")

        return self.ticket_repo.list_all(
            page=page,
            limit=limit,
            status_filter=status_filter,
            type_filter=type_filter,
            priority_filter=priority_filter,
        )

    def get_ticket_by_id(self, ticket_id: str) -> Dict:
        """Get a single ticket by ID."""
        ticket = self.ticket_repo.get_by_id(ticket_id)
        if not ticket:
            raise TicketNotFoundError(ticket_id)
        return ticket

    def create_ticket(
        self,
        user_id: str,
        ticket_type: str,
        priority: str,
        subject: str,
        description: str,
        attachments: Optional[List[Dict]] = None,
    ) -> Dict:
        """Create a new ticket with validation."""
        if ticket_type not in VALID_TICKET_TYPES:
            raise ValidationError(f"Invalid ticket type: {ticket_type}", "type")

        if priority not in VALID_PRIORITIES:
            raise ValidationError(f"Invalid priority: {priority}", "priority")

        if len(subject) < settings.SUBJECT_MIN_LENGTH:
            raise ValidationError(
                f"Subject must be at least {settings.SUBJECT_MIN_LENGTH} characters",
                "subject",
            )
        if len(subject) > settings.SUBJECT_MAX_LENGTH:
            raise ValidationError(
                f"Subject must be at most {settings.SUBJECT_MAX_LENGTH} characters",
                "subject",
            )

        if len(description) < settings.DESCRIPTION_MIN_LENGTH:
            raise ValidationError(
                f"Description must be at least {settings.DESCRIPTION_MIN_LENGTH} characters",
                "description",
            )
        if len(description) > settings.DESCRIPTION_MAX_LENGTH:
            raise ValidationError(
                f"Description must be at most {settings.DESCRIPTION_MAX_LENGTH} characters",
                "description",
            )

        if attachments and len(attachments) > settings.MAX_ATTACHMENTS_PER_TICKET:
            raise TooManyAttachmentsError(settings.MAX_ATTACHMENTS_PER_TICKET)

        ticket_id = str(ULID())

        ticket_data = {
            'ticketId': ticket_id,
            'merchantId': self.merchant_id,
            'userId': user_id,
            'type': ticket_type,
            'status': TICKET_STATUS_OPEN,
            'priority': priority,
            'subject': subject,
            'description': description,
            'attachments': attachments or [],
        }

        return self.ticket_repo.create(ticket_data)

    def update_ticket(
        self,
        ticket_id: str,
        subject: Optional[str] = None,
        description: Optional[str] = None,
        ticket_type: Optional[str] = None,
        priority: Optional[str] = None,
        attachments: Optional[List[Dict]] = None,
    ) -> Dict:
        """Update ticket fields (not status — use update_ticket_status)."""
        self.get_ticket_by_id(ticket_id)

        updates = {}

        if subject is not None:
            if len(subject) < settings.SUBJECT_MIN_LENGTH or len(subject) > settings.SUBJECT_MAX_LENGTH:
                raise ValidationError(
                    f"Subject must be {settings.SUBJECT_MIN_LENGTH}-{settings.SUBJECT_MAX_LENGTH} characters",
                    "subject",
                )
            updates['subject'] = subject

        if description is not None:
            if len(description) < settings.DESCRIPTION_MIN_LENGTH or len(description) > settings.DESCRIPTION_MAX_LENGTH:
                raise ValidationError(
                    f"Description must be {settings.DESCRIPTION_MIN_LENGTH}-{settings.DESCRIPTION_MAX_LENGTH} characters",
                    "description",
                )
            updates['description'] = description

        if ticket_type is not None:
            if ticket_type not in VALID_TICKET_TYPES:
                raise ValidationError(f"Invalid ticket type: {ticket_type}", "type")
            updates['type'] = ticket_type

        if priority is not None:
            if priority not in VALID_PRIORITIES:
                raise ValidationError(f"Invalid priority: {priority}", "priority")
            updates['priority'] = priority

        if attachments is not None:
            if len(attachments) > settings.MAX_ATTACHMENTS_PER_TICKET:
                raise TooManyAttachmentsError(settings.MAX_ATTACHMENTS_PER_TICKET)
            updates['attachments'] = attachments

        if not updates:
            raise ValidationError("No fields to update")

        return self.ticket_repo.update(ticket_id, updates)

    def update_ticket_status(self, ticket_id: str, new_status: str) -> Dict:
        """Transition ticket status with state machine validation."""
        if new_status not in VALID_TICKET_STATUSES:
            raise ValidationError(f"Invalid status: {new_status}", "status")

        ticket = self.get_ticket_by_id(ticket_id)
        current_status = ticket['status']

        allowed = STATUS_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise InvalidStatusTransitionError(current_status, new_status)

        updates = {'status': new_status}
        if new_status in (TICKET_STATUS_CANCELLED, 'CLOSED'):
            from datetime import datetime, timezone
            updates['closedAt'] = datetime.now(timezone.utc).isoformat()

        return self.ticket_repo.update(ticket_id, updates)

    def cancel_ticket(self, ticket_id: str) -> Dict:
        """Cancel a ticket (convenience method)."""
        return self.update_ticket_status(ticket_id, TICKET_STATUS_CANCELLED)
