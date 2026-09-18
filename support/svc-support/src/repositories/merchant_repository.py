"""Merchant repository — read-only merchant name lookup for resolve-on-read.

The TICKET# item does not carry ``merchantName`` (R-7), so the support console
resolves it from the MERCHANT# item in the shared platform table when mapping a
ticket for display. Read-only slice of svc-iam's MerchantRepository.
"""
import logging
from typing import Dict, Optional

from core.database import db_client
from core.utils.constants import PK_MERCHANT

logger = logging.getLogger(__name__)


class MerchantRepository:
    """Read-only merchant lookup (PK=MERCHANT#{id}, SK=MERCHANT#{id})."""

    def __init__(self):
        self.table = db_client.get_platform_table()

    def get_name(self, merchant_id: str) -> Optional[str]:
        """Return the merchant's display name, or None if not found."""
        if not merchant_id:
            return None
        try:
            response = self.table.get_item(
                Key={
                    'PK': f'{PK_MERCHANT}{merchant_id}',
                    'SK': f'{PK_MERCHANT}{merchant_id}',
                },
                ProjectionExpression='#n',
                ExpressionAttributeNames={'#n': 'name'},
            )
        except Exception as e:
            logger.warning(f"Merchant name lookup failed for {merchant_id}: {e}")
            return None
        item = response.get('Item')
        return item.get('name') if item else None
