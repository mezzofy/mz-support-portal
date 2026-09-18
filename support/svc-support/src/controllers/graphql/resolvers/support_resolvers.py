import strawberry
from typing import List, Optional

from strawberry.types import Info

from controllers.graphql.context import SupportGraphQLContext
from controllers.graphql.errors import SupportGraphQLError
from controllers.graphql.types.support_ticket_types import SupportTicket, PaginatedSupportTickets
from controllers.graphql.types.message_types import Message
from controllers.graphql.types.common_types import MessageResponse
from controllers.graphql.inputs.support_inputs import (
    SupportTicketFiltersInput, AssignTicketInput, SendSupportMessageInput,
)
from core.errors import SupportError
from services.support_ticket_service import SupportTicketService


def _filter_args(filters: Optional[SupportTicketFiltersInput]) -> dict:
    """Flatten a filters input into service kwargs (None when absent)."""
    if not filters:
        return {}
    return {
        "merchant_id": filters.merchant_id,
        "status": filters.status,
        "type_": filters.type,
        "priority": filters.priority,
        "assignee_id": filters.assignee_id,
        "unassigned": filters.unassigned,
        "search": filters.search,
    }


def _attachments_to_dicts(attachments) -> Optional[List[dict]]:
    if not attachments:
        return None
    return [
        {
            "id": a.id,
            "fileName": a.file_name,
            "fileSize": a.file_size,
            "fileType": a.file_type,
            "url": a.url,
            "uploadedAt": a.uploaded_at,
        }
        for a in attachments
    ]


@strawberry.type
class SupportQuery:
    @strawberry.field
    def support_tickets(
        self,
        info: Info[SupportGraphQLContext, None],
        page: int = 1,
        limit: int = 20,
        filters: Optional[SupportTicketFiltersInput] = None,
    ) -> PaginatedSupportTickets:
        try:
            items, total = SupportTicketService().list_support_tickets(
                page=page, limit=limit, **_filter_args(filters)
            )
            return PaginatedSupportTickets(
                tickets=[SupportTicket.from_dict(t) for t in items],
                total=total, page=page, limit=limit,
            )
        except SupportError as e:
            raise SupportGraphQLError(e)

    @strawberry.field
    def support_ticket(
        self,
        info: Info[SupportGraphQLContext, None],
        ticket_id: str,
    ) -> SupportTicket:
        try:
            result = SupportTicketService().get_support_ticket(ticket_id)
            return SupportTicket.from_dict(result)
        except SupportError as e:
            raise SupportGraphQLError(e)

    @strawberry.field
    def my_assigned_tickets(
        self,
        info: Info[SupportGraphQLContext, None],
        page: int = 1,
        limit: int = 20,
        filters: Optional[SupportTicketFiltersInput] = None,
    ) -> PaginatedSupportTickets:
        try:
            args = _filter_args(filters)
            # "my assigned" pins assignee to the acting agent (overrides any filter).
            args.pop("assignee_id", None)
            args.pop("unassigned", None)
            items, total = SupportTicketService().list_my_assigned(
                agent_id=info.context.agent_id, page=page, limit=limit, **args
            )
            return PaginatedSupportTickets(
                tickets=[SupportTicket.from_dict(t) for t in items],
                total=total, page=page, limit=limit,
            )
        except SupportError as e:
            raise SupportGraphQLError(e)

    @strawberry.field
    def messages(
        self,
        info: Info[SupportGraphQLContext, None],
        ticket_id: str,
    ) -> List[Message]:
        try:
            results = SupportTicketService().list_messages(ticket_id)
            return [Message.from_dict(m) for m in results]
        except SupportError as e:
            raise SupportGraphQLError(e)


@strawberry.type
class SupportMutation:
    @strawberry.mutation
    def assign_ticket(
        self,
        info: Info[SupportGraphQLContext, None],
        input: AssignTicketInput,
    ) -> SupportTicket:
        try:
            result = SupportTicketService().assign_ticket(
                ticket_id=input.ticket_id,
                assignee_id=input.assignee_id,
                assignee_name=input.assignee_name,
                assigned_team=input.assigned_team,
                default_team=info.context.team,
            )
            return SupportTicket.from_dict(result)
        except SupportError as e:
            raise SupportGraphQLError(e)

    @strawberry.mutation
    def update_ticket_status(
        self,
        info: Info[SupportGraphQLContext, None],
        ticket_id: str,
        status: str,
    ) -> SupportTicket:
        try:
            result = SupportTicketService().update_status(ticket_id, status)
            return SupportTicket.from_dict(result)
        except SupportError as e:
            raise SupportGraphQLError(e)

    @strawberry.mutation
    def send_support_message(
        self,
        info: Info[SupportGraphQLContext, None],
        input: SendSupportMessageInput,
    ) -> Message:
        try:
            result = SupportTicketService().send_support_message(
                ticket_id=input.ticket_id,
                agent_id=info.context.agent_id,     # forced senderId
                content=input.content,
                attachments=_attachments_to_dicts(input.attachments),
            )
            return Message.from_dict(result)
        except SupportError as e:
            raise SupportGraphQLError(e)

    @strawberry.mutation
    def mark_messages_as_read(
        self,
        info: Info[SupportGraphQLContext, None],
        ticket_id: str,
        user_id: str,
    ) -> MessageResponse:
        try:
            count = SupportTicketService().mark_messages_as_read(ticket_id, user_id)
            return MessageResponse(message=f"{count} message(s) marked as read")
        except SupportError as e:
            raise SupportGraphQLError(e)
