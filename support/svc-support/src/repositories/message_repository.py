"""Message repository — PostgreSQL CRUD for the `messages` table (mezzofy_ai).

Re-platformed from DynamoDB (Option B). Public method signatures unchanged so the
vendored MessageService keeps working. Returns camelCase domain dicts.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from psycopg2.extras import Json

from core.database import get_db_client

logger = logging.getLogger(__name__)


def _iso(value) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat() if isinstance(value, datetime) else str(value)


def _row_to_message(row: Dict) -> Dict:
    return {
        "messageId": row["message_id"],
        "ticketId": row["ticket_id"],
        "merchantId": row["merchant_id"],
        "senderId": row["sender_id"],
        "senderType": row["sender_type"],
        "content": row["content"],
        "attachments": row.get("attachments") or [],
        "isRead": row["is_read"],
        "createdAt": _iso(row["created_at"]),
    }


class MessageRepository:
    """PostgreSQL CRUD for message rows in `mezzofy_ai.messages`."""

    def __init__(self, merchant_id: str):
        self.merchant_id = merchant_id

    def list_by_ticket(self, ticket_id: str) -> List[Dict]:
        """Get all messages for a ticket, chronological (oldest first)."""
        with get_db_client().cursor() as cur:
            cur.execute(
                "SELECT * FROM messages WHERE ticket_id = %s ORDER BY created_at ASC",
                (ticket_id,),
            )
            rows = cur.fetchall()
        return [_row_to_message(r) for r in rows]

    def get_by_id(self, ticket_id: str, message_id: str) -> Optional[Dict]:
        """Get a single message by ticket ID and message ID."""
        with get_db_client().cursor() as cur:
            cur.execute(
                "SELECT * FROM messages WHERE ticket_id = %s AND message_id = %s",
                (ticket_id, message_id),
            )
            row = cur.fetchone()
        return _row_to_message(row) if row else None

    def create(self, message_data: Dict) -> Dict:
        """Create a new message under a ticket."""
        now = datetime.now(timezone.utc)
        with get_db_client().cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO messages
                    (message_id, ticket_id, merchant_id, sender_id, sender_type,
                     content, attachments, is_read, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    message_data["messageId"],
                    message_data["ticketId"],
                    message_data["merchantId"],
                    message_data["senderId"],
                    message_data["senderType"],
                    message_data["content"],
                    Json(message_data.get("attachments") or []),
                    message_data.get("isRead", False),
                    now,
                ),
            )
            row = cur.fetchone()
        logger.info("Created message %s for ticket %s", row["message_id"], row["ticket_id"])
        return _row_to_message(row)

    def mark_as_read(self, ticket_id: str, message_ids: List[str]) -> int:
        """Mark the given messages read. Returns the count actually updated."""
        if not message_ids:
            return 0
        with get_db_client().cursor(commit=True) as cur:
            cur.execute(
                "UPDATE messages SET is_read = TRUE "
                "WHERE ticket_id = %s AND message_id = ANY(%s)",
                (ticket_id, list(message_ids)),
            )
            return cur.rowcount

    def mark_all_as_read_for_user(self, ticket_id: str, user_id: str) -> int:
        """Mark all unread messages NOT sent by this user as read. Returns count."""
        with get_db_client().cursor(commit=True) as cur:
            cur.execute(
                "UPDATE messages SET is_read = TRUE "
                "WHERE ticket_id = %s AND is_read = FALSE AND sender_id <> %s",
                (ticket_id, user_id),
            )
            return cur.rowcount
