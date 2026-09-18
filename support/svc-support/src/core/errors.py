from typing import Optional


class SupportError(Exception):
    """Base exception for Support module (vendored from TicketsError)."""

    def __init__(self, message: str, code: str, status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(self.message)


# Backwards-compatible alias — vendored ticket/message services import TicketsError.
TicketsError = SupportError


class TokenExpiredError(SupportError):
    """Raised when token has expired"""

    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, "TOKEN_EXPIRED", 401)


class TokenInvalidError(SupportError):
    """Raised when token is invalid"""

    def __init__(self, message: str = "Invalid token"):
        super().__init__(message, "TOKEN_INVALID", 401)


class AuthenticationError(SupportError):
    """Raised when a request carries no / an unreadable credential (401)."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, "AUTHENTICATION_REQUIRED", 401)


class ValidationError(SupportError):
    """Raised when validation fails"""

    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message, "VALIDATION_ERROR", 400)
        self.field = field


class ResourceNotFoundError(SupportError):
    """Raised when resource is not found"""

    def __init__(self, resource: str, resource_id: str):
        message = f"{resource} with ID '{resource_id}' not found"
        super().__init__(message, "RESOURCE_NOT_FOUND", 404)
        self.resource = resource
        self.resource_id = resource_id


class TicketNotFoundError(ResourceNotFoundError):
    """Raised when ticket is not found"""

    def __init__(self, ticket_id: str):
        super().__init__("Ticket", ticket_id)
        self.code = "TICKET_NOT_FOUND"


class MessageNotFoundError(ResourceNotFoundError):
    """Raised when message is not found"""

    def __init__(self, message_id: str):
        super().__init__("Message", message_id)
        self.code = "MESSAGE_NOT_FOUND"


class InvalidStatusTransitionError(SupportError):
    """Raised when ticket status transition is invalid"""

    def __init__(self, current_status: str, target_status: str):
        message = f"Cannot transition from '{current_status}' to '{target_status}'"
        super().__init__(message, "INVALID_STATUS_TRANSITION", 400)
        self.current_status = current_status
        self.target_status = target_status


class AttachmentError(SupportError):
    """Raised for attachment-related errors"""

    def __init__(self, message: str, code: str = "ATTACHMENT_ERROR"):
        super().__init__(message, code, 400)


class TooManyAttachmentsError(AttachmentError):
    """Raised when too many attachments"""

    def __init__(self, max_count: int):
        super().__init__(
            f"Maximum {max_count} attachments allowed",
            "TOO_MANY_ATTACHMENTS"
        )


class PermissionDeniedError(SupportError):
    """Raised when the caller is not an authorized support agent (403)."""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, "PERMISSION_DENIED", 403)
