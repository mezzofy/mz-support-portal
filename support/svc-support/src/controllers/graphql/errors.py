from graphql import GraphQLError

from core.errors import (
    SupportError, ValidationError, ResourceNotFoundError,
    InvalidStatusTransitionError,
)


class SupportGraphQLError(GraphQLError):
    """Maps SupportError fields into GraphQL error extensions."""

    def __init__(self, support_error: SupportError):
        extensions = {
            "code": support_error.code,
            "status_code": support_error.status_code,
        }

        if isinstance(support_error, ValidationError) and getattr(support_error, "field", None):
            extensions["field"] = support_error.field

        if isinstance(support_error, ResourceNotFoundError):
            extensions["resource"] = support_error.resource
            extensions["resource_id"] = support_error.resource_id

        if isinstance(support_error, InvalidStatusTransitionError):
            extensions["current_status"] = support_error.current_status
            extensions["target_status"] = support_error.target_status

        super().__init__(
            message=support_error.message,
            extensions=extensions,
        )
