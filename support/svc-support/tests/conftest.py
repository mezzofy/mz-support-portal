"""Shared pytest fixtures for svc-support (CR-support-console-v1.0, Gate 3).

Stands up an in-memory ``mz-platform-dev`` with moto using the REAL platform key
schema (PK/SK + GSI1 for token/session lookup + GSI2 for the cross-merchant
ticket queue), then patches the ``db_client`` singleton so every repository under
``src/`` reads/writes the mock table. NO live AWS is touched.

Seed model (single-table, byte-compatible with svc-tickets / the merchant view):
  * TICKET#{id}   PK==SK, entityType=TICKET, GSI2PK=ENTITY#TICKET, GSI2SK={createdAt}#{id}
  * MESSAGE#{id}  PK=TICKET#{ticketId}, SK=MESSAGE#{id}, entityType=MESSAGE
  * MERCHANT#{id} PK==SK, name (for merchantName resolve-on-read)
  * SESSION       GSI1PK=TOKEN#{token}, sessionType STAFF|MERCHANT, permissions (auth tests)
"""
import os
import sys
import time

import boto3
import pytest
from moto import mock_aws

# Make ``src/`` importable exactly like the service runs it (uvicorn from src/).
SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))

PLATFORM_TABLE = "mz-platform-dev"


# ── AWS env so moto/boto never reach for real credentials ──────────────────────
@pytest.fixture(autouse=True)
def aws_env(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ENDPOINT_URL", "")


def _create_platform_table(dynamodb):
    """Create mz-platform-dev with GSI1 (token/session) and GSI2 (entity queue)."""
    dynamodb.create_table(
        TableName=PLATFORM_TABLE,
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
            {"AttributeName": "GSI2PK", "AttributeType": "S"},
            {"AttributeName": "GSI2SK", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI2",
                "KeySchema": [
                    {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI2SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
        BillingMode="PAY_PER_REQUEST",
    )


class Seeder:
    """Thin helper to put the exact single-table item shapes svc-support reads."""

    def __init__(self, table):
        self.table = table
        self._n = 0

    def _next_created_at(self) -> str:
        # Monotonic, sortable timestamps so GSI2SK ordering is deterministic.
        self._n += 1
        return f"2026-09-1{self._n // 10}T00:00:{self._n % 60:02d}.000000+00:00"

    def ticket(self, ticket_id, merchant_id, **overrides):
        created_at = overrides.pop("createdAt", None) or self._next_created_at()
        item = {
            "PK": f"TICKET#{ticket_id}",
            "SK": f"TICKET#{ticket_id}",
            "entityType": "TICKET",
            "GSI2PK": "ENTITY#TICKET",
            "GSI2SK": f"{created_at}#{ticket_id}",
            "ticketId": ticket_id,
            "merchantId": merchant_id,
            "userId": overrides.pop("userId", "user-cust-1"),
            "type": overrides.pop("type", "GENERAL"),
            "status": overrides.pop("status", "OPEN"),
            "priority": overrides.pop("priority", "MEDIUM"),
            "subject": overrides.pop("subject", "Help please"),
            "description": overrides.pop("description", "Something is broken."),
            "attachments": overrides.pop("attachments", []),
            "createdAt": created_at,
            "updatedAt": overrides.pop("updatedAt", created_at),
        }
        item.update(overrides)  # assigneeId / assignedTeam / closedAt / etc.
        self.table.put_item(Item=item)
        return item

    def message(self, ticket_id, message_id, sender_id, sender_type, **overrides):
        created_at = overrides.pop("createdAt", None) or self._next_created_at()
        item = {
            "PK": f"TICKET#{ticket_id}",
            "SK": f"MESSAGE#{message_id}",
            "entityType": "MESSAGE",
            "messageId": message_id,
            "ticketId": ticket_id,
            "merchantId": overrides.pop("merchantId", "merchant-A"),
            "senderId": sender_id,
            "senderType": sender_type,
            "content": overrides.pop("content", "hello"),
            "attachments": overrides.pop("attachments", []),
            "isRead": overrides.pop("isRead", False),
            "createdAt": created_at,
        }
        item.update(overrides)
        self.table.put_item(Item=item)
        return item

    def merchant(self, merchant_id, name):
        self.table.put_item(Item={
            "PK": f"MERCHANT#{merchant_id}",
            "SK": f"MERCHANT#{merchant_id}",
            "entityType": "MERCHANT",
            "merchantId": merchant_id,
            "name": name,
        })

    def session(self, token, *, session_type, permissions=None, staff_team=None,
                merchant_id=None, user_id="user-agent-1", email="agent@mezzofy.com",
                expires_at=None):
        item = {
            "PK": f"SESSION#{token}",
            "SK": f"SESSION#{token}",
            "entityType": "SESSION",
            "GSI1PK": f"TOKEN#{token}",
            "GSI1SK": "SESSION",
            "sessionId": f"sess-{token}",
            "userId": user_id,
            "email": email,
            "sessionType": session_type,
            "accessToken": token,
            "permissions": permissions if permissions is not None else [],
            "expiresAt": expires_at if expires_at is not None else int(time.time()) + 3600,
        }
        if staff_team is not None:
            item["staffTeam"] = staff_team
        if merchant_id is not None:
            item["merchantId"] = merchant_id
        self.table.put_item(Item=item)
        return item


@pytest.fixture
def platform(aws_env):
    """Mocked mz-platform-dev + patched db_client; yields a Seeder.

    Resets the token_service singleton so its cached table handle is rebound to
    the mock resource for each test.
    """
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        _create_platform_table(dynamodb)

        from core.database import db_client
        original_resource = db_client._resource
        db_client._resource = dynamodb

        # Rebind the lazy token-service singleton to the mock table.
        import auth.token_service as ts
        ts._token_service = None

        yield Seeder(db_client.get_platform_table())

        db_client._resource = original_resource
        ts._token_service = None
