import strawberry
from typing import List

from controllers.graphql.types.attachment_types import Attachment


@strawberry.type
class Message:
    """Frozen SDL §4 Message type — the support-facing projection.

    Deliberately omits ``merchantId`` (present on the stored item and on the
    merchant svc-tickets type) so the exposed SDL matches the frozen contract
    exactly: messageId, ticketId, senderId, senderType, content, attachments,
    isRead, createdAt.
    """
    message_id: str
    ticket_id: str
    sender_id: str
    sender_type: str
    content: str
    attachments: List[Attachment]
    is_read: bool
    created_at: str

    @classmethod
    def from_dict(cls, data: dict) -> "Message":
        attachments_raw = data.get("attachments", [])
        attachments = [Attachment.from_dict(a) for a in attachments_raw] if attachments_raw else []

        return cls(
            message_id=data.get("messageId", ""),
            ticket_id=data.get("ticketId", ""),
            sender_id=data.get("senderId", ""),
            sender_type=data.get("senderType", ""),
            content=data.get("content", ""),
            attachments=attachments,
            is_read=data.get("isRead", False),
            created_at=data.get("createdAt", ""),
        )
