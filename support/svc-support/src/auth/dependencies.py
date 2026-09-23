"""Support-agent authentication — resolves a mz-ai-assistant JWT into a SupportContext.

Re-platformed for Option B (auth reuse). svc-support authorizes staff who hold a
mz-ai-assistant access token whose `role` is a support-console role
(`support_agent`/`support_manager`) — or an admin (`*` in permissions). A token
for any other role is valid but NOT a support agent → 403 (the coarse RBAC-deny
the Tester asserts). Missing/invalid/expired token → 401.
"""
from dataclasses import dataclass, field
from typing import List

from fastapi import Request

from core.config import settings
from core.errors import AuthenticationError, PermissionDeniedError
from core.utils.constants import (
    STAFF_TEAM_SUPPORT,
    VALID_STAFF_TEAMS,
    SUPPORT_CONSOLE_ROLES,
)
from auth.token_service import get_token_service


@dataclass
class SupportContext:
    """Authenticated support-agent identity extracted from a mz-ai JWT."""
    agent_id: str            # claims.user_id  → Message.senderId on SUPPORT replies + assignee id
    agent_name: str          # claims.name (or email) → display / assignee name
    team: str                # mapped from claims.department → a VALID_STAFF_TEAM
    permissions: List = field(default_factory=list)   # JWT permission strings
    session_id: str = ""     # claims.jti


def _map_team(department: str) -> str:
    """Map the JWT `department` (e.g. 'support') to a staff team (uppercase).

    Falls back to SUPPORT when the department isn't one of the staff teams —
    assign_ticket validates the team against VALID_STAFF_TEAMS.
    """
    team = (department or "").upper()
    return team if team in VALID_STAFF_TEAMS else STAFF_TEAM_SUPPORT


def _is_authorized(role: str, permissions: List) -> bool:
    """True if the token's role may use the support console (or is admin)."""
    return role in SUPPORT_CONSOLE_ROLES or "*" in (permissions or [])


def resolve_agent_context(request: Request) -> SupportContext:
    """Validate the request's staff JWT and build a SupportContext.

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
                team=_map_team(request.headers.get("X-Agent-Team", STAFF_TEAM_SUPPORT)),
                permissions=["*"],
                session_id="dev-session",
            )

    # ── Production: mz-ai-assistant Bearer JWT ──
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthenticationError("Missing or malformed Authorization header")

    token = auth_header[7:]

    try:
        claims = get_token_service().validate_access_token(token)
    except Exception:
        # Invalid or expired token → 401 (do not leak which).
        raise AuthenticationError("Invalid or expired token")

    # Defense-in-depth: device-bound tokens are for paired hardware, not the console.
    if claims.get("device_id"):
        raise PermissionDeniedError("Device tokens are not permitted on the support console")

    # ── Coarse RBAC: must be a support-console role (or admin) ──
    role = claims.get("role", "")
    permissions = claims.get("permissions", []) or []
    if not _is_authorized(role, permissions):
        raise PermissionDeniedError("Not authorized for the support console")

    return SupportContext(
        agent_id=str(claims.get("user_id") or claims.get("sub") or ""),
        agent_name=claims.get("name") or claims.get("email") or "",
        team=_map_team(claims.get("department", "")),
        permissions=permissions,
        session_id=claims.get("jti", ""),
    )
