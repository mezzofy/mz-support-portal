"""Shared pytest fixtures for svc-support (CR-support-postgres-repivot, Gate 3).

Re-platformed from moto/DynamoDB to PostgreSQL (Option B) + mz-ai JWT auth.

Two tiers:
  * UNIT (runs everywhere, no DB): auth RBAC via real JWTs + HTTP 401/403 deny
    (auth is resolved in get_context BEFORE any resolver/DB call).
  * INTEGRATION (`@pytest.mark.integration`, auto-skip): repo/service/GraphQL against
    a REAL Postgres. Enabled ONLY when SVC_SUPPORT_TEST_DATABASE_URL is set — a
    DEDICATED test DB, because the fixture TRUNCATEs tickets/messages/merchants.
    Never falls back to DATABASE_URL, so a real/prod DB is never truncated.
"""
import os
import sys
import time

import pytest

# ── Env MUST be set before importing any src module (Settings() reads it at import) ──
os.environ.setdefault("JWT_SECRET", "test-secret-key-minimum-thirty-two-chars-000")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("ENVIRONMENT", "development")

_TEST_DB = os.environ.get("SVC_SUPPORT_TEST_DATABASE_URL")
if _TEST_DB:
    os.environ["DATABASE_URL"] = _TEST_DB  # repos + fixture share this via get_db_client()

# Make src/ importable exactly like the service runs it (uvicorn from src/).
SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, SRC)

from jose import jwt  # noqa: E402
from core.config import settings  # noqa: E402


# ── JWT helper (mirrors mz-ai-assistant access-token claims) ───────────────────

def make_token(
    role: str = "support_agent",
    *,
    permissions=None,
    department: str = "support",
    token_type: str = "access",
    exp_delta: int = 300,
    **extra,
) -> str:
    """Sign a mz-ai-style access token with the test JWT_SECRET."""
    now = int(time.time())
    claims = {
        "user_id": "u-agent-1",
        "sub": "u-agent-1",
        "name": "Sam Rivera",
        "email": "sam@mezzofy.com",
        "department": department,
        "role": role,
        "permissions": ["support_read"] if permissions is None else permissions,
        "token_type": token_type,
        "jti": "jti-1",
        "iat": now,
        "exp": now + exp_delta,
    }
    claims.update(extra)
    return jwt.encode(claims, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@pytest.fixture
def token():
    """Expose the token factory to tests."""
    return make_token


# ── FastAPI TestClient (no DB needed for auth-deny paths) ──────────────────────

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


def gql(client, query: str, headers=None, variables=None):
    """POST a GraphQL operation; returns the httpx Response."""
    body = {"query": query}
    if variables is not None:
        body["variables"] = variables
    return client.post("/support/api/graphql", json=body, headers=headers or {})


# ── Integration: real Postgres (dedicated test DB only) ────────────────────────

_DDL = """
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id CHAR(26) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(8) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description VARCHAR(5000) NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    assignee_id VARCHAR(64), assignee_name VARCHAR(255),
    assigned_team VARCHAR(64), assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS messages (
    message_id CHAR(26) PRIMARY KEY,
    ticket_id CHAR(26) NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    merchant_id VARCHAR(64) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    sender_type VARCHAR(8) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS merchants (
    merchant_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


@pytest.fixture(scope="session")
def _pg_ready():
    url = os.environ.get("SVC_SUPPORT_TEST_DATABASE_URL")
    if not url:
        pytest.skip("integration: set SVC_SUPPORT_TEST_DATABASE_URL to a dedicated test DB")
    import psycopg2
    from core.database import _libpq_dsn, get_db_client
    try:
        conn = psycopg2.connect(_libpq_dsn(url))
    except Exception as e:  # pragma: no cover - env dependent
        pytest.skip(f"integration: test DB unreachable ({e})")
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(_DDL)
    conn.close()
    return get_db_client()


@pytest.fixture
def pg(_pg_ready):
    """Clean + seed the test DB before each integration test; returns the client."""
    client = _pg_ready
    with client.cursor(commit=True) as cur:
        cur.execute("TRUNCATE tickets, messages, merchants CASCADE")
        cur.execute(
            "INSERT INTO merchants (merchant_id, name) VALUES "
            "('m_acme','Acme Retail'), ('m_blue','Blue Sky Cafe')"
        )
    return client
