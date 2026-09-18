"""Support-agent authentication — resolves a staff session into a SupportContext.

Design reference: backend-to-lead-support-staff-auth-design §3.

Unlike svc-tickets (which 401s any token WITHOUT a merchantId), svc-support
requires a *staff* session: one whose ``sessionType == "STAFF"`` AND which
carries a ``SUPPORT_TICKETS`` permission. A merchant token (or a dev-merchant
token) is a valid opaque token but is NOT a support agent → 403 (the coarse
RBAC-deny the Tester asserts).
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict

from fastapi import Request

from core.config import settings
from core.errors import AuthenticationError, PermissionDeniedError
from core.utils.constants import (
    SESSION_TYPE_STAFF,
    STAFF_TEAM_SUPPORT,
    PERMISSION_RESOURCE_SUPPORT_TICKETS,
)
from auth.token_service import get_token_service


@dataclass
class SupportContext:
    """Authenticated support-agent identity extracted from a STAFF session."""
    agent_id: str            # session.userId  → Message.senderId on SUPPORT replies
    agent_name: str          # session.email   → Message display / assignee name
    team: str                # session.staffTeam ("SUPPORT" | "SALES" | "FINANCE")
    permissions: List[Dict] = field(default_factory=list)
    session_id: str = ""


def _has_support_permission(permissions: List[Dict]) -> bool:
    """True if the session grants any action on the SUPPORT_TICKETS resource.

    MVP RBAC is coarse (D1): presence of the resource is enough; per-action
    gating (VIEW/ADD/EDIT/APPROVE) is deferred.
    """
    for perm in permissions or []:
        if not isinstance(perm, dict):
            continue
        if perm.get("resource") == PERMISSION_RESOURCE_SUPPORT_TICKETS and perm.get("actions"):
            return True
    return False


def resolve_agent_context(request: Request) -> SupportContext:
    """Validate the request's staff credential and build a SupportContext.

    Raises:
        AuthenticationError (401): no / malformed credential, or invalid/expired token.
        PermissionDeniedError (403): valid token but not an authorized support agent.
    """
    # ── Development bypass: X-Agent-Id header (only when ENVIRONMENT=development) ──
    if settings.ENVIRONMENT == "development":
        dev_agent_id = request.headers.get("X-Agent-Id")
        if dev_agent_id:
            return SupportContext(
                agent_id=dev_agent_id,
                agent_name=request.headers.get("X-Agent-Email", f"{dev_agent_id}@mezzofy.com"),
                team=request.headers.get("X-Agent-Team", STAFF_TEAM_SUPPORT),
                permissions=[{
                    "resource": PERMISSION_RESOURCE_SUPPORT_TICKETS,
                    "actions": ["VIEW", "ADD", "EDIT", "APPROVE"],
                }],
                session_id="dev-session",
            )

    # ── Production: opaque Bearer token → SESSION lookup ──
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthenticationError("Missing or malformed Authorization header")

    token = auth_header[7:]

    try:
        session = get_token_service().validate_access_token(token)
    except Exception:
        # Invalid or expired token → 401 (do not leak which).
        raise AuthenticationError("Invalid or expired token")

    # ── Coarse RBAC: must be a STAFF session carrying SUPPORT_TICKETS ──
    if session.get("sessionType") != SESSION_TYPE_STAFF:
        raise PermissionDeniedError("Not a support-staff session")

    if not _has_support_permission(session.get("permissions", [])):
        raise PermissionDeniedError("Session lacks SUPPORT_TICKETS permission")

    return SupportContext(
        agent_id=session.get("userId", ""),
        agent_name=session.get("email", ""),
        team=session.get("staffTeam", STAFF_TEAM_SUPPORT),
        permissions=session.get("permissions", []),
        session_id=session.get("sessionId", ""),
    )
