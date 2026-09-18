"""Message service — send messages, list messages, mark read.

VENDORED UNCHANGED from svc-tickets. The support console instantiates this with
the *ticket's own* merchantId and forces ``sender_type=SUPPORT`` so replies land
in the exact item shape the merchant view reads.
"""
import logging
from typing import Dict, List, Optional

from ulid import ULID

from core.config import settings
from core.errors import (
    TicketNotFoundError,
    ValidationError,
    TooManyAttachmentsError,
)
from core.utils.constants import VALID_SENDER_TYPES, SENDER_TYPE_USER
from repositories.ticket_repository import TicketRepository
from repositories.message_repository import MessageRepository

logger = logging.getLogger(__name__)


class MessageService:
    """Business logic for ticket messages."""

    def __init__(
        self,
        merchant_id: str,
        ticket_repo: Optional[TicketRepository] = None,
        message_repo: Optional[MessageRepository] = None,
    ):
        self.merchant_id = merchant_id
        self.ticket_repo = ticket_repo or TicketRepository(merchant_id)
        self.message_repo = message_repo or MessageRepository(merchant_id)

    def _ensure_ticket_exists(self, ticket_id: str) -> Dict:
        """Verify the ticket exists, raise TicketNotFoundError if not."""
        ticket = self.ticket_repo.get_by_id(ticket_id)
        if not ticket:
            raise TicketNotFoundError(ticket_id)
        return ticket

    def list_messages(self, ticket_id: str) -> List[Dict]:
        """Get all messages for a ticket in chronological order."""
        self._ensure_ticket_exists(ticket_id)
        return self.message_repo.list_by_ticket(ticket_id)

    def send_message(
        self,
        ticket_id: str,
        sender_id: str,
        content: str,
        sender_type: str = SENDER_TYPE_USER,
        attachments: Optional[List[Dict]] = None,
    ) -> Dict:
        """Send a new message on a ticket."""
        self._ensure_ticket_exists(ticket_id)

        if sender_type not in VALID_SENDER_TYPES:
            raise ValidationError(f"Invalid sender type: {sender_type}", "senderType")

        if len(content) < settings.MESSAGE_MIN_LENGTH:
            raise ValidationError(
                f"Message must be at least {settings.MESSAGE_MIN_LENGTH} character(s)",
                "content",
            )
        if len(content) > settings.MESSAGE_MAX_LENGTH:
            raise ValidationError(
                f"Message must be at most {settings.MESSAGE_MAX_LENGTH} characters",
                "content",
            )

        if attachments and len(attachments) > settings.MAX_ATTACHMENTS_PER_MESSAGE:
            raise TooManyAttachmentsError(settings.MAX_ATTACHMENTS_PER_MESSAGE)

        message_id = str(ULID())

        message_data = {
            'messageId': message_id,
            'ticketId': ticket_id,
            'merchantId': self.merchant_id,
            'senderId': sender_id,
            'senderType': sender_type,
            'content': content,
            'attachments': attachments or [],
        }

        return self.message_repo.create(message_data)

    def mark_messages_as_read(self, ticket_id: str, user_id: str) -> int:
        """Mark all unread messages (not sent by this user) as read.

        Returns the count of messages marked as read.
        """
        self._ensure_ticket_exists(ticket_id)
        return self.message_repo.mark_all_as_read_for_user(ticket_id, user_id)
