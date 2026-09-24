"""Auth + coarse RBAC — Option B (mz-ai JWT reuse). Runs WITHOUT a database:
auth is resolved in get_context before any resolver/DB call.

Covers `resolve_agent_context` directly (unit) and the GraphQL HTTP boundary
(401/403 vs 200) via TestClient.
"""
import time

import pytest

from conftest import make_token, gql
from auth.dependencies import resolve_agent_context
from core.errors import AuthenticationError, PermissionDeniedError


class _Req:
    """Minimal stand-in for starlette Request (only .headers is used)."""
    def __init__(self, headers):
        self.headers = headers

    class _C:
        host = "127.0.0.1"
    client = _C()


# ── Unit: resolve_agent_context ────────────────────────────────────────────────

def test_valid_support_agent_builds_context():
    ctx = resolve_agent_context(_Req({"Authorization": "Bearer " + make_token(role="support_agent")}))
    assert ctx.agent_id == "u-agent-1"
    assert ctx.agent_name == "Sam Rivera"
    assert ctx.team == "SUPPORT"           # department 'support' -> uppercased team
    assert ctx.session_id == "jti-1"


def test_support_manager_allowed():
    ctx = resolve_agent_context(_Req({"Authorization": "Bearer " + make_token(role="support_manager")}))
    assert ctx.agent_id == "u-agent-1"


def test_admin_star_permission_allowed_regardless_of_role():
    tok = make_token(role="executive", permissions=["*"])
    assert resolve_agent_context(_Req({"Authorization": "Bearer " + tok})).agent_id == "u-agent-1"


@pytest.mark.parametrize("role", ["sales_rep", "finance_viewer", "hr_staff", "merchant", ""])
def test_non_support_role_forbidden(role):
    tok = make_token(role=role, permissions=["something_else"])
    with pytest.raises(PermissionDeniedError):
        resolve_agent_context(_Req({"Authorization": "Bearer " + tok}))


def test_device_token_forbidden():
    tok = make_token(role="support_agent", device_id="stackchan-1")
    with pytest.raises(PermissionDeniedError):
        resolve_agent_context(_Req({"Authorization": "Bearer " + tok}))


def test_missing_header_unauthenticated():
    with pytest.raises(AuthenticationError):
        resolve_agent_context(_Req({}))


def test_malformed_header_unauthenticated():
    with pytest.raises(AuthenticationError):
        resolve_agent_context(_Req({"Authorization": "Token abc"}))


def test_garbage_token_unauthenticated():
    with pytest.raises(AuthenticationError):
        resolve_agent_context(_Req({"Authorization": "Bearer not-a-jwt"}))


def test_expired_token_unauthenticated():
    tok = make_token(role="support_agent", exp_delta=-10)
    with pytest.raises(AuthenticationError):
        resolve_agent_context(_Req({"Authorization": "Bearer " + tok}))


def test_non_access_token_type_unauthenticated():
    tok = make_token(role="support_agent", token_type="refresh")
    with pytest.raises(AuthenticationError):
        resolve_agent_context(_Req({"Authorization": "Bearer " + tok}))


def test_dev_bypass_header(monkeypatch):
    # ENVIRONMENT=development (conftest default) + X-Agent-Id → dev context, no JWT.
    ctx = resolve_agent_context(_Req({"X-Agent-Id": "dev-1", "X-Agent-Team": "SUPPORT"}))
    assert ctx.agent_id == "dev-1" and ctx.team == "SUPPORT"


# ── HTTP boundary: GraphQL 401/403/200 (no DB — __typename never touches the DB) ─

def test_http_no_token_401(client):
    r = gql(client, "{ __typename }")
    assert r.status_code == 401


def test_http_merchant_role_403(client):
    tok = make_token(role="sales_rep", permissions=["sales_read"])
    r = gql(client, "{ __typename }", headers={"Authorization": "Bearer " + tok})
    assert r.status_code == 403


def test_http_device_token_403(client):
    tok = make_token(role="support_agent", device_id="stackchan-1")
    r = gql(client, "{ __typename }", headers={"Authorization": "Bearer " + tok})
    assert r.status_code == 403


def test_http_valid_support_token_passes_auth(client):
    tok = make_token(role="support_agent")
    r = gql(client, "{ __typename }", headers={"Authorization": "Bearer " + tok})
    assert r.status_code == 200
    body = r.json()
    assert "errors" not in body           # auth passed → query executed
    assert body["data"]["__typename"]     # root query type name (SupportQuery)


def test_http_dev_bypass_passes_auth(client):
    r = gql(client, "{ __typename }", headers={"X-Agent-Id": "dev-1"})
    assert r.status_code == 200
