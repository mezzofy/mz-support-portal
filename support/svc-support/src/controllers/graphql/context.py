"""GraphQL request context for svc-support.

Every GraphQL operation is authenticated at the context boundary: the request's
staff credential is resolved into a SupportContext, and a failure is surfaced as
a real HTTP status (401 no/invalid token, 403 not a support agent) — this is
where the coarse RBAC-deny lives.
"""
from dataclasses import dataclass
from typing import Optional

from fastapi import Request, HTTPException
from strawberry.fastapi import BaseContext

from core.errors import SupportError
from auth.dependencies import SupportContext, resolve_agent_context


@dataclass
class SupportGraphQLContext(BaseContext):
    agent: Optional[SupportContext] = None
    ip_address: str = "unknown"
    user_agent: str = "unknown"

    def __post_init__(self):
        super().__init__()

    # Convenience accessors for resolvers.
    @property
    def agent_id(self) -> str:
        return self.agent.agent_id if self.agent else ""

    @property
    def agent_name(self) -> str:
        return self.agent.agent_name if self.agent else ""

    @property
    def team(self) -> str:
        return self.agent.team if self.agent else ""


async def get_context(request: Request) -> SupportGraphQLContext:
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")

    try:
        agent = resolve_agent_context(request)
    except SupportError as e:
        # 401 (AuthenticationError/Token*) or 403 (PermissionDeniedError).
        raise HTTPException(status_code=e.status_code, detail=e.message)

    ctx = SupportGraphQLContext(
        agent=agent,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    ctx.request = request
    return ctx
