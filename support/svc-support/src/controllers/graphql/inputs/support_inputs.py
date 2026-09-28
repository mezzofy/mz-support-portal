import strawberry
from typing import Optional, List


@strawberry.input
class AttachmentInput:
    id: str
    file_name: str
    file_size: int
    file_type: str
    url: str
    uploaded_at: str


@strawberry.input
class SupportTicketFiltersInput:
    merchant_id: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    unassigned: Optional[bool] = None
    search: Optional[str] = None


@strawberry.input
class AssignTicketInput:
    ticket_id: str
    assignee_id: str
    assignee_name: Optional[str] = None
    assigned_team: Optional[str] = None


@strawberry.input
class SendSupportMessageInput:
    ticket_id: str
    content: str
    attachments: Optional[List[AttachmentInput]] = None


@strawberry.input
class CreateSupportTicketInput:
    """Staff-created ticket on behalf of a merchant (Option C intake)."""
    merchant_id: str
    type: str
    priority: str
    subject: str
    description: str
    # Optional: register/refresh the merchant's display name (upserts merchants).
    merchant_name: Optional[str] = None
    # Optional merchant-side contact this is logged for; defaults to the acting agent.
    on_behalf_of_user_id: Optional[str] = None
    attachments: Optional[List[AttachmentInput]] = None
