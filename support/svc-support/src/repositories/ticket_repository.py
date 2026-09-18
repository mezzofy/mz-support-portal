"""Ticket repository — DynamoDB CRUD for TICKET# items in platform table (mz-platform-dev).

Vendored from svc-tickets and extended for the support console with:
  * ``list_all_cross_merchant()`` — the merchant queue read model WITHOUT the
    per-merchant filter (GSI2 + in-memory refine, DB §8.2, fine <10K tickets).
  * ``assign()`` — writes the sparse assignment attributes via the existing
    dynamic ``update()`` (no schema change / no migration).
The merchant-scoped ``list_all()`` is kept intact for byte-compatibility and
is simply not used by the support resolvers.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from boto3.dynamodb.conditions import Key, Attr

from core.database import db_client
from core.errors import TicketNotFoundError
from core.utils.constants import (
    PK_TICKET, ENTITY_TICKET, GSI2_NAME, GSI2_ENTITY, SYSTEM_ATTRS,
    ATTR_ASSIGNEE_ID, ATTR_ASSIGNEE_NAME, ATTR_ASSIGNED_TEAM, ATTR_ASSIGNED_AT,
)

logger = logging.getLogger(__name__)

_SYSTEM_ATTRS = SYSTEM_ATTRS


def _strip_system_attrs(item: Dict) -> Dict:
    return {k: v for k, v in item.items() if k not in _SYSTEM_ATTRS}


class TicketRepository:
    """DynamoDB CRUD for ticket items in platform table (mz-platform-dev).

    Single-table layout:
        PK: TICKET#{ticketId}
        SK: TICKET#{ticketId}
        entityType: TICKET
        GSI2PK: ENTITY#TICKET
        GSI2SK: {createdAt}#{ticketId}
    """

    def __init__(self, merchant_id: str = ""):
        # merchant_id is optional for the support console (cross-merchant actor);
        # kept in the signature for parity with the vendored svc-tickets repo.
        self.merchant_id = merchant_id
        self.table = db_client.get_platform_table()

    def get_by_id(self, ticket_id: str) -> Optional[Dict]:
        """Get a single ticket by ID."""
        response = self.table.get_item(
            Key={'PK': f'{PK_TICKET}{ticket_id}', 'SK': f'{PK_TICKET}{ticket_id}'}
        )
        item = response.get('Item')
        if not item:
            return None
        return _strip_system_attrs(item)

    def _query_all_tickets(self) -> List[Dict]:
        """Fetch every TICKET item via GSI2 (Scan fallback), newest-first."""
        try:
            response = self.table.query(
                IndexName=GSI2_NAME,
                KeyConditionExpression=Key('GSI2PK').eq(f'{GSI2_ENTITY}{ENTITY_TICKET}'),
                ScanIndexForward=False,  # Newest first
            )
            items = response.get('Items', [])
        except Exception as e:
            logger.warning(f"GSI2 query failed, falling back to Scan: {e}")
            response = self.table.scan(
                FilterExpression=Attr('entityType').eq(ENTITY_TICKET),
            )
            items = response.get('Items', [])
            items.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return [_strip_system_attrs(item) for item in items]

    def list_all(
        self,
        page: int = 1,
        limit: int = 20,
        status_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Merchant-scoped listing (vendored — kept for parity, unused by support)."""
        tickets = self._query_all_tickets()
        tickets = [t for t in tickets if t.get('merchantId') == self.merchant_id]

        if status_filter:
            tickets = [t for t in tickets if t.get('status') == status_filter]
        if type_filter:
            tickets = [t for t in tickets if t.get('type') == type_filter]
        if priority_filter:
            tickets = [t for t in tickets if t.get('priority') == priority_filter]

        total = len(tickets)
        start = (page - 1) * limit
        return tickets[start:start + limit], total

    def list_all_cross_merchant(
        self,
        page: int = 1,
        limit: int = 20,
        merchant_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        assignee_id: Optional[str] = None,
        unassigned: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Cross-merchant queue: GSI2 (all tickets, newest-first) + in-memory refine.

        This is ``list_all`` WITHOUT the ``merchantId`` self-filter; merchantId
        becomes an *optional* filter instead of a hard scope. Returns
        ``(page_items, total_matching)``.
        """
        tickets = self._query_all_tickets()

        # Optional merchant filter (an explicit choice, not an implicit scope).
        if merchant_id:
            tickets = [t for t in tickets if t.get('merchantId') == merchant_id]
        if status_filter:
            tickets = [t for t in tickets if t.get('status') == status_filter]
        if type_filter:
            tickets = [t for t in tickets if t.get('type') == type_filter]
        if priority_filter:
            tickets = [t for t in tickets if t.get('priority') == priority_filter]
        if assignee_id:
            tickets = [t for t in tickets if t.get('assigneeId') == assignee_id]
        if unassigned:
            tickets = [t for t in tickets if not t.get('assigneeId')]
        if search:
            needle = search.strip().lower()
            tickets = [
                t for t in tickets
                if needle in (t.get('subject', '') or '').lower()
                or needle in (t.get('description', '') or '').lower()
                or needle in (t.get('merchantId', '') or '').lower()
            ]

        total = len(tickets)
        start = (page - 1) * limit
        return tickets[start:start + limit], total

    def create(self, ticket_data: Dict) -> Dict:
        """Create a new ticket item (parity with svc-tickets; unused by support)."""
        ticket_id = ticket_data['ticketId']
        now = datetime.now(timezone.utc).isoformat()

        ticket_data.setdefault('createdAt', now)
        ticket_data.setdefault('updatedAt', now)

        item = {
            'PK': f'{PK_TICKET}{ticket_id}',
            'SK': f'{PK_TICKET}{ticket_id}',
            'entityType': ENTITY_TICKET,
            'GSI2PK': f'{GSI2_ENTITY}{ENTITY_TICKET}',
            'GSI2SK': f'{ticket_data["createdAt"]}#{ticket_id}',
            **ticket_data,
        }

        self.table.put_item(Item=item)
        return ticket_data

    def update(self, ticket_id: str, updates: Dict) -> Dict:
        """Update a ticket item with dynamic UpdateExpression."""
        existing = self.get_by_id(ticket_id)
        if not existing:
            raise TicketNotFoundError(ticket_id)

        updates['updatedAt'] = datetime.now(timezone.utc).isoformat()

        expr_parts = []
        attr_names = {}
        attr_values = {}

        for i, (key, value) in enumerate(updates.items()):
            safe_key = f'#k{i}'
            safe_val = f':v{i}'
            expr_parts.append(f'{safe_key} = {safe_val}')
            attr_names[safe_key] = key
            attr_values[safe_val] = value

        update_expr = 'SET ' + ', '.join(expr_parts)

        response = self.table.update_item(
            Key={'PK': f'{PK_TICKET}{ticket_id}', 'SK': f'{PK_TICKET}{ticket_id}'},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ReturnValues='ALL_NEW',
        )

        return _strip_system_attrs(response.get('Attributes', {}))

    def assign(
        self,
        ticket_id: str,
        assignee_id: str,
        assignee_name: Optional[str] = None,
        assigned_team: Optional[str] = None,
    ) -> Dict:
        """Write the sparse assignment attributes onto a ticket (no migration).

        Uses the existing dynamic ``update()`` so ``assigneeId`` /
        ``assigneeName`` / ``assignedTeam`` / ``assignedAt`` are added as plain
        item attributes and become visible to both the support and merchant views.
        """
        now = datetime.now(timezone.utc).isoformat()
        updates = {
            ATTR_ASSIGNEE_ID: assignee_id,
            ATTR_ASSIGNED_AT: now,
        }
        if assignee_name is not None:
            updates[ATTR_ASSIGNEE_NAME] = assignee_name
        if assigned_team is not None:
            updates[ATTR_ASSIGNED_TEAM] = assigned_team
        return self.update(ticket_id, updates)

    def delete(self, ticket_id: str) -> None:
        """Delete a ticket item."""
        self.table.delete_item(
            Key={'PK': f'{PK_TICKET}{ticket_id}', 'SK': f'{PK_TICKET}{ticket_id}'}
        )
