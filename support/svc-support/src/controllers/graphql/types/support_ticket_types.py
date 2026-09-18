import strawberry
from typing import List, Optional

from controllers.graphql.types.attachment_types import Attachment


@strawberry.type
class SupportTicket:
    """Frozen SDL §4 SupportTicket = merchant Ticket + merchantName + assignee*.

    ``merchantName`` is resolved-on-read (R-7); ``assignee*`` / ``assignedTeam`` /
    ``assignedAt`` are sparse item attributes (absent until first assignment).
    """
    ticket_id: str
    merchant_id: str
    merchant_name: Optional[str] = None
    user_id: str = ""
    type: str = ""
    status: str = ""
    priority: str = ""
    subject: str = ""
    description: str = ""
    attachments: List[Attachment] = strawberry.field(default_factory=list)
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assigned_team: Optional[str] = None
    assigned_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    closed_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "SupportTicket":
        attachments_raw = data.get("attachments", [])
        attachments = [Attachment.from_dict(a) for a in attachments_raw] if attachments_raw else []

        return cls(
            ticket_id=data.get("ticketId", ""),
            merchant_id=data.get("merchantId", ""),
            merchant_name=data.get("merchantName"),
            user_id=data.get("userId", ""),
            type=data.get("type", ""),
            status=data.get("status", ""),
            priority=data.get("priority", ""),
            subject=data.get("subject", ""),
            description=data.get("description", ""),
            attachments=attachments,
            assignee_id=data.get("assigneeId"),
            assignee_name=data.get("assigneeName"),
            assigned_team=data.get("assignedTeam"),
            assigned_at=data.get("assignedAt"),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
            closed_at=data.get("closedAt"),
        )


@strawberry.type
class PaginatedSupportTickets:
    tickets: List[SupportTicket]
    total: int
    page: int
    limit: int
