"""RBAC boundary — resolve_agent_context + the GraphQL context HTTP mapping.

The support console is staff-only. These tests assert the coarse RBAC contract
from the handoff:
  * no / invalid token           → 401 (AuthenticationError)
  * valid MERCHANT session        → 403 (PermissionDeniedError)
  * STAFF session w/o perm        → 403
  * valid STAFF session           → SupportContext
  * X-Agent-Id dev bypass          → only when ENVIRONMENT=development
and that get_context() surfaces those as REAL HTTP status codes (not GraphQL
errors).
"""
import pytest
from fastapi import HTTPException

from core.config import settings
from core.errors import AuthenticationError, PermissionDeniedError
from auth.dependencies import resolve_agent_context, SupportContext
from controllers.graphql.context import get_context

SUPPORT_PERM = [{"resource": "SUPPORT_TICKETS", "actions": ["VIEW", "ADD", "EDIT", "APPROVE"]}]


class _StubRequest:
    """Minimal stand-in for starlette Request (headers.get + client.host)."""

    def __init__(self, headers=None, client_host="1.2.3.4"):
        self.headers = headers or {}

        class _Client:
            host = client_host
        self.client = _Client() if client_host else None


@pytest.fixture
def prod_env(monkeypatch):
    """Force production so the X-Agent-Id dev bypass is OFF and tokens are checked."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")


@pytest.fixture
def dev_env(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")


# ── resolve_agent_context ──────────────────────────────────────────────────────

class TestResolveAgentContext:
    def test_no_auth_header_raises_401(self, platform, prod_env):
        with pytest.raises(AuthenticationError) as exc:
            resolve_agent_context(_StubRequest(headers={}))
        assert exc.value.status_code == 401

    def test_malformed_header_raises_401(self, platform, prod_env):
        req = _StubRequest(headers={"Authorization": "Token abc"})
        with pytest.raises(AuthenticationError) as exc:
            resolve_agent_context(req)
        assert exc.value.status_code == 401

    def test_invalid_token_raises_401(self, platform, prod_env):
        # No SESSION seeded for this token → lookup fails → 401.
        req = _StubRequest(headers={"Authorization": "Bearer does-not-exist"})
        with pytest.raises(AuthenticationError) as exc:
            resolve_agent_context(req)
        assert exc.value.status_code == 401

    def test_valid_merchant_session_raises_403(self, platform, prod_env):
        platform.session("mtok", session_type="MERCHANT", merchant_id="merchant-A",
                          permissions=[])
        req = _StubRequest(headers={"Authorization": "Bearer mtok"})
        with pytest.raises(PermissionDeniedError) as exc:
            resolve_agent_context(req)
        assert exc.value.status_code == 403

    def test_staff_session_without_support_permission_raises_403(self, platform, prod_env):
        platform.session("stok", session_type="STAFF", staff_team="SUPPORT",
                          permissions=[{"resource": "REPORTS", "actions": ["VIEW"]}])
        req = _StubRequest(headers={"Authorization": "Bearer stok"})
        with pytest.raises(PermissionDeniedError) as exc:
            resolve_agent_context(req)
        assert exc.value.status_code == 403

    def test_valid_staff_session_returns_context(self, platform, prod_env):
        platform.session("gtok", session_type="STAFF", staff_team="SALES",
                          permissions=SUPPORT_PERM, user_id="user-agent-9",
                          email="sam@mezzofy.com")
        req = _StubRequest(headers={"Authorization": "Bearer gtok"})

        ctx = resolve_agent_context(req)
        assert isinstance(ctx, SupportContext)
        assert ctx.agent_id == "user-agent-9"
        assert ctx.agent_name == "sam@mezzofy.com"
        assert ctx.team == "SALES"

    def test_expired_staff_token_raises_401(self, platform, prod_env):
        platform.session("etok", session_type="STAFF", staff_team="SUPPORT",
                          permissions=SUPPORT_PERM, expires_at=0)
        req = _StubRequest(headers={"Authorization": "Bearer etok"})
        with pytest.raises(AuthenticationError) as exc:
            resolve_agent_context(req)
        assert exc.value.status_code == 401


# ── Dev bypass (X-Agent-Id) ────────────────────────────────────────────────────

class TestDevBypass:
    def test_dev_bypass_works_in_development(self, platform, dev_env):
        req = _StubRequest(headers={
            "X-Agent-Id": "agent-dev",
            "X-Agent-Email": "dev@mezzofy.com",
            "X-Agent-Team": "FINANCE",
        })
        ctx = resolve_agent_context(req)
        assert ctx.agent_id == "agent-dev"
        assert ctx.agent_name == "dev@mezzofy.com"
        assert ctx.team == "FINANCE"

    def test_dev_bypass_ignored_in_production(self, platform, prod_env):
        # Same header, but production → falls through to token check → 401.
        req = _StubRequest(headers={"X-Agent-Id": "agent-dev"})
        with pytest.raises(AuthenticationError):
            resolve_agent_context(req)


# ── get_context() HTTP-status mapping (the 401/403 are real HTTP, not GraphQL) ──

class TestGetContextHttpMapping:
    @pytest.mark.asyncio
    async def test_no_token_maps_to_http_401(self, platform, prod_env):
        with pytest.raises(HTTPException) as exc:
            await get_context(_StubRequest(headers={}))
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_merchant_token_maps_to_http_403(self, platform, prod_env):
        platform.session("mtok", session_type="MERCHANT", merchant_id="merchant-A",
                          permissions=[])
        with pytest.raises(HTTPException) as exc:
            await get_context(_StubRequest(headers={"Authorization": "Bearer mtok"}))
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_valid_staff_token_builds_context(self, platform, prod_env):
        platform.session("gtok", session_type="STAFF", staff_team="SUPPORT",
                          permissions=SUPPORT_PERM, user_id="user-agent-9")
        ctx = await get_context(_StubRequest(headers={"Authorization": "Bearer gtok"}))
        assert ctx.agent_id == "user-agent-9"
        assert ctx.team == "SUPPORT"
