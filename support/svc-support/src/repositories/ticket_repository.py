"""Ticket repository — PostgreSQL CRUD for the `tickets` table (mezzofy_ai).

Re-platformed from DynamoDB (Option B). Public method signatures are unchanged
so the vendored TicketService / SupportTicketService keep working as-is. The
DynamoDB "fetch all + in-memory refine" cross-merchant path now pushes filters
and pagination into SQL (`WHERE … ORDER BY created_at DESC LIMIT/OFFSET`).

Return shape: domain dicts with camelCase keys (ticketId, merchantId, …) — the
same contract the services + GraphQL mappers already consume. Sparse assignment
fields (assigneeId/assigneeName/assignedTeam/assignedAt) and closedAt are OMITTED
when NULL, mirroring the DynamoDB "absent when unset" behaviour.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from psycopg2.extras import Json

from core.database import get_db_client
from core.errors import TicketNotFoundError
from core.utils.constants import (
    ATTR_ASSIGNEE_ID, ATTR_ASSIGNEE_NAME, ATTR_ASSIGNED_TEAM, ATTR_ASSIGNED_AT,
)

logger = logging.getLogger(__name__)

# camelCase update key -> column. Only these columns are updatable via update().
_UPDATABLE_COLUMNS = {
    "status": "status",
    "priority": "priority",
    "type": "type",
    "subject": "subject",
    "description": "description",
    "attachments": "attachments",
    "closedAt": "closed_at",
    ATTR_ASSIGNEE_ID: "assignee_id",
    ATTR_ASSIGNEE_NAME: "assignee_name",
    ATTR_ASSIGNED_TEAM: "assigned_team",
    ATTR_ASSIGNED_AT: "assigned_at",
}


def _iso(value) -> Optional[str]:
    """Render a DB datetime as an ISO8601 string (the DynamoDB contract)."""
    if value is None:
        return None
    return value.isoformat() if isinstance(value, datetime) else str(value)


def _row_to_ticket(row: Dict) -> Dict:
    """Map a `tickets` row (snake_case) to the camelCase domain dict."""
    ticket = {
        "ticketId": row["ticket_id"],
        "merchantId": row["merchant_id"],
        "userId": row["user_id"],
        "type": row["type"],
        "status": row["status"],
        "priority": row["priority"],
        "subject": row["subject"],
        "description": row["description"],
        "attachments": row.get("attachments") or [],
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }
    if row.get("assignee_id") is not None:
        ticket["assigneeId"] = row["assignee_id"]
    if row.get("assignee_name") is not None:
        ticket["assigneeName"] = row["assignee_name"]
    if row.get("assigned_team") is not None:
        ticket["assignedTeam"] = row["assigned_team"]
    if row.get("assigned_at") is not None:
        ticket["assignedAt"] = _iso(row["assigned_at"])
    if row.get("closed_at") is not None:
        ticket["closedAt"] = _iso(row["closed_at"])
    return ticket


class TicketRepository:
    """PostgreSQL CRUD for ticket rows in `mezzofy_ai.tickets`."""

    def __init__(self, merchant_id: str = ""):
        # merchant_id is optional for the support console (cross-merchant actor);
        # kept in the signature for parity with the vendored svc-tickets repo.
        self.merchant_id = merchant_id

    def get_by_id(self, ticket_id: str) -> Optional[Dict]:
        """Get a single ticket by ID."""
        with get_db_client().cursor() as cur:
            cur.execute("SELECT * FROM tickets WHERE ticket_id = %s", (ticket_id,))
            row = cur.fetchone()
        return _row_to_ticket(row) if row else None

    def _paged(
        self, where: List[str], params: List, page: int, limit: int
    ) -> Tuple[List[Dict], int]:
        """Run COUNT + a page SELECT for the given WHERE predicates."""
        where_sql = (" WHERE " + " AND ".join(where)) if where else ""
        offset = max(page - 1, 0) * limit
        with get_db_client().cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM tickets{where_sql}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM tickets{where_sql} "
                f"ORDER BY created_at DESC LIMIT %s OFFSET %s",
                params + [limit, offset],
            )
            rows = cur.fetchall()
        return [_row_to_ticket(r) for r in rows], total

    def list_all(
        self,
        page: int = 1,
        limit: int = 20,
        status_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
    ) -> Tuple[List[Dict], int]:
        """Merchant-scoped listing (vendored — kept for parity, unused by support)."""
        where = ["merchant_id = %s"]
        params: List = [self.merchant_id]
        if status_filter:
            where.append("status = %s")
            params.append(status_filter)
        if type_filter:
            where.append("type = %s")
            params.append(type_filter)
        if priority_filter:
            where.append("priority = %s")
            params.append(priority_filter)
        return self._paged(where, params, page, limit)

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
        """Cross-merchant queue: SQL filters + pagination; returns (page_items, total_matching)."""
        where: List[str] = []
        params: List = []
        if merchant_id:
            where.append("merchant_id = %s")
            params.append(merchant_id)
        if status_filter:
            where.append("status = %s")
            params.append(status_filter)
        if type_filter:
            where.append("type = %s")
            params.append(type_filter)
        if priority_filter:
            where.append("priority = %s")
            params.append(priority_filter)
        if assignee_id:
            where.append("assignee_id = %s")
            params.append(assignee_id)
        if unassigned:
            where.append("assignee_id IS NULL")
        if search:
            where.append(
                "(subject ILIKE %s OR description ILIKE %s OR merchant_id ILIKE %s)"
            )
            needle = f"%{search.strip()}%"
            params.extend([needle, needle, needle])
        return self._paged(where, params, page, limit)

    def create(self, ticket_data: Dict) -> Dict:
        """Create a new ticket row (parity with svc-tickets; unused by support)."""
        now = datetime.now(timezone.utc)
        with get_db_client().cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO tickets
                    (ticket_id, merchant_id, user_id, type, status, priority,
                     subject, description, attachments, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    ticket_data["ticketId"],
                    ticket_data["merchantId"],
                    ticket_data["userId"],
                    ticket_data["type"],
                    ticket_data["status"],
                    ticket_data["priority"],
                    ticket_data["subject"],
                    ticket_data["description"],
                    Json(ticket_data.get("attachments") or []),
                    now,
                    now,
                ),
            )
            row = cur.fetchone()
        return _row_to_ticket(row)

    def update(self, ticket_id: str, updates: Dict) -> Dict:
        """Partial update; always stamps updated_at; returns the full new row.

        Raises TicketNotFoundError if the ticket does not exist.
        """
        set_parts: List[str] = []
        params: List = []
        for key, value in updates.items():
            if key == "updatedAt":
                continue  # forced below
            column = _UPDATABLE_COLUMNS.get(key)
            if column is None:
                continue  # ignore keys that are not updatable columns
            set_parts.append(f"{column} = %s")
            params.append(Json(value) if column == "attachments" else value)

        set_parts.append("updated_at = %s")
        params.append(datetime.now(timezone.utc))
        params.append(ticket_id)

        with get_db_client().cursor(commit=True) as cur:
            cur.execute(
                f"UPDATE tickets SET {', '.join(set_parts)} "
                f"WHERE ticket_id = %s RETURNING *",
                params,
            )
            row = cur.fetchone()
        if row is None:
            raise TicketNotFoundError(ticket_id)
        return _row_to_ticket(row)

    def assign(
        self,
        ticket_id: str,
        assignee_id: str,
        assignee_name: Optional[str] = None,
        assigned_team: Optional[str] = None,
    ) -> Dict:
        """Write the sparse assignment attributes onto a ticket via update()."""
        now = datetime.now(timezone.utc).isoformat()
        updates: Dict = {
            ATTR_ASSIGNEE_ID: assignee_id,
            ATTR_ASSIGNED_AT: now,
        }
        if assignee_name is not None:
            updates[ATTR_ASSIGNEE_NAME] = assignee_name
        if assigned_team is not None:
            updates[ATTR_ASSIGNED_TEAM] = assigned_team
        return self.update(ticket_id, updates)

    def delete(self, ticket_id: str) -> None:
        """Delete a ticket row (cascades to its messages)."""
        with get_db_client().cursor(commit=True) as cur:
            cur.execute("DELETE FROM tickets WHERE ticket_id = %s", (ticket_id,))
