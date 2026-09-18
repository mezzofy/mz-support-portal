"""Message repository — DynamoDB CRUD for MESSAGE# items under TICKET# PK in platform table (mz-platform-dev).

Vendored unchanged from svc-tickets so support replies land in the exact same
item layout the merchant view reads.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from boto3.dynamodb.conditions import Key

from core.database import db_client
from core.utils.constants import PK_TICKET, PK_MESSAGE, ENTITY_MESSAGE, SYSTEM_ATTRS

logger = logging.getLogger(__name__)

_SYSTEM_ATTRS = SYSTEM_ATTRS


def _strip_system_attrs(item: Dict) -> Dict:
    return {k: v for k, v in item.items() if k not in _SYSTEM_ATTRS}


class MessageRepository:
    """DynamoDB CRUD for message items in platform table (mz-platform-dev).

    Single-table layout:
        PK: TICKET#{ticketId}
        SK: MESSAGE#{messageId}
        entityType: MESSAGE
    """

    def __init__(self, merchant_id: str):
        self.merchant_id = merchant_id
        self.table = db_client.get_platform_table()

    def list_by_ticket(self, ticket_id: str) -> List[Dict]:
        """Get all messages for a ticket, ordered by creation time."""
        response = self.table.query(
            KeyConditionExpression=(
                Key('PK').eq(f'{PK_TICKET}{ticket_id}') &
                Key('SK').begins_with(PK_MESSAGE)
            ),
            ScanIndexForward=True,  # Oldest first (chronological)
        )
        items = response.get('Items', [])
        return [_strip_system_attrs(item) for item in items]

    def get_by_id(self, ticket_id: str, message_id: str) -> Optional[Dict]:
        """Get a single message by ticket ID and message ID."""
        response = self.table.get_item(
            Key={
                'PK': f'{PK_TICKET}{ticket_id}',
                'SK': f'{PK_MESSAGE}{message_id}',
            }
        )
        item = response.get('Item')
        if not item:
            return None
        return _strip_system_attrs(item)

    def create(self, message_data: Dict) -> Dict:
        """Create a new message item under a ticket."""
        ticket_id = message_data['ticketId']
        message_id = message_data['messageId']
        now = datetime.now(timezone.utc).isoformat()

        message_data.setdefault('createdAt', now)
        message_data.setdefault('isRead', False)

        item = {
            'PK': f'{PK_TICKET}{ticket_id}',
            'SK': f'{PK_MESSAGE}{message_id}',
            'entityType': ENTITY_MESSAGE,
            **message_data,
        }

        self.table.put_item(Item=item)
        logger.info(f"Created message {message_id} for ticket {ticket_id}")
        return message_data

    def mark_as_read(self, ticket_id: str, message_ids: List[str]) -> int:
        """Mark multiple messages as read. Returns count of updated messages."""
        updated = 0
        for message_id in message_ids:
            try:
                self.table.update_item(
                    Key={
                        'PK': f'{PK_TICKET}{ticket_id}',
                        'SK': f'{PK_MESSAGE}{message_id}',
                    },
                    UpdateExpression='SET isRead = :val',
                    ExpressionAttributeValues={':val': True},
                    ConditionExpression='attribute_exists(PK)',
                )
                updated += 1
            except Exception:
                logger.warning(f"Failed to mark message {message_id} as read")
        return updated

    def mark_all_as_read_for_user(self, ticket_id: str, user_id: str) -> int:
        """Mark all unread messages not sent by this user as read."""
        messages = self.list_by_ticket(ticket_id)
        unread_ids = [
            m['messageId'] for m in messages
            if not m.get('isRead', False) and m.get('senderId') != user_id
        ]
        if not unread_ids:
            return 0
        return self.mark_as_read(ticket_id, unread_ids)
