import strawberry
from typing import List, Optional

from controllers.graphql.types.attachment_types import Attachment


@strawberry.type
class SupportTicket:
    """General-usage SupportTicket = requestor identity + ticket fields + assignee*.

    ``requestorName`` / ``requestorEmail`` identify who raised the ticket (merchant
    fields removed, CR-ticket-general-usage). ``assignee*`` / ``assignedTeam`` /
    ``assignedAt`` are sparse attributes (absent until first assignment).
    """
    ticket_id: str
    requestor_name: Optional[str] = None
    requestor_email: Optional[str] = None
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
            requestor_name=data.get("requestorName"),
            requestor_email=data.get("requestorEmail"),
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
