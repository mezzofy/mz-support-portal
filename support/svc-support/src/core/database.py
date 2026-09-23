"""PostgreSQL client for the Support module (mezzofy_ai).

Re-platformed from DynamoDB (Option B). Synchronous psycopg2 with a small
threaded connection pool — deliberately sync so the vendored ticket/message
services and GraphQL resolvers stay UNCHANGED (they call the repositories
synchronously). svc-support is a separate service/process; it does not share
the mz-ai-assistant async SQLAlchemy engine — it just talks to the same DB.
"""
import logging
from contextlib import contextmanager
from typing import Optional

import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)


def _libpq_dsn(url: str) -> str:
    """Normalize a SQLAlchemy-style URL to a libpq DSN psycopg2 accepts.

    mz-ai-assistant stores DATABASE_URL as `postgresql+asyncpg://…`; psycopg2
    needs `postgresql://…` (same trick the mz-ai `scripts/migrate.py` uses).
    """
    return (
        url.replace("postgresql+asyncpg://", "postgresql://")
           .replace("postgresql+psycopg2://", "postgresql://")
    )


class PostgresClient:
    """Synchronous PostgreSQL access with a threaded connection pool."""

    def __init__(self):
        self._pool = ThreadedConnectionPool(
            minconn=settings.DB_POOL_MIN,
            maxconn=settings.DB_POOL_MAX,
            dsn=_libpq_dsn(settings.DATABASE_URL),
        )

    @contextmanager
    def cursor(self, *, commit: bool = False):
        """Borrow a pooled connection and yield a dict cursor.

        Commits on clean exit when `commit=True`; always rolls back on error and
        returns the connection to the pool.
        """
        conn = self._pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)


# Lazy singleton — the pool connects on first USE, not at import, so modules can
# be imported (and unit-tested with a mocked client) without a live database.
_db_client: Optional[PostgresClient] = None


def get_db_client() -> PostgresClient:
    global _db_client
    if _db_client is None:
        _db_client = PostgresClient()
    return _db_client
