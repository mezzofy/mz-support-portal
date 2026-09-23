"""Merchant repository — read-only merchant name lookup for resolve-on-read.

Re-platformed from DynamoDB (Option B). The ticket row does not carry
`merchantName`; the support console resolves it from the `merchants` reference
table when mapping a ticket for display (falls back to merchantId in the service).
"""
import logging
from typing import Optional

from core.database import get_db_client

logger = logging.getLogger(__name__)


class MerchantRepository:
    """Read-only merchant lookup against `mezzofy_ai.merchants`."""

    def __init__(self):
        pass

    def get_name(self, merchant_id: str) -> Optional[str]:
        """Return the merchant's display name, or None if not found."""
        if not merchant_id:
            return None
        try:
            with get_db_client().cursor() as cur:
                cur.execute(
                    "SELECT name FROM merchants WHERE merchant_id = %s",
                    (merchant_id,),
                )
                row = cur.fetchone()
        except Exception as e:
            logger.warning("Merchant name lookup failed for %s: %s", merchant_id, e)
            return None
        return row["name"] if row else None
