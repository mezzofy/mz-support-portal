"""
Opaque Token Validation Service (vendored unchanged from svc-tickets).

Validates Bearer tokens issued by svc-iam by looking up SESSION items
via GSI1 (TOKEN#{accessToken}) in the shared platform DynamoDB table.
"""
import time
import logging
from typing import Dict, Optional

from boto3.dynamodb.conditions import Key

from core.database import db_client
from core.config import settings
from core.errors import TokenExpiredError, TokenInvalidError
from core.utils.constants import GSI1_NAME, GSI1_TOKEN, SYSTEM_ATTRS

logger = logging.getLogger(__name__)


def _strip_system_attrs(item: Dict) -> Dict:
    """Remove single-table system attributes from an item."""
    return {k: v for k, v in item.items() if k not in SYSTEM_ATTRS}


class TokenService:
    """Opaque token validation via GSI1 SESSION lookup in DynamoDB.

    Tokens are cryptographically random URL-safe strings with no embedded
    claims. Validation resolves the SESSION item minted by svc-iam.
    """

    def __init__(self):
        self.table = db_client.get_platform_table()

    def validate_access_token(self, access_token: str) -> Dict:
        """Validate an opaque access token by looking up the SESSION via GSI1.

        Returns the full session context. For a support-staff session this
        includes: userId, email, sessionType, staffTeam, roleId, permissions.

        Raises:
            TokenInvalidError: If no session found for the token
            TokenExpiredError: If the session has expired
        """
        try:
            response = self.table.query(
                IndexName=GSI1_NAME,
                KeyConditionExpression=Key('GSI1PK').eq(f'{GSI1_TOKEN}{access_token}'),
            )
        except Exception as e:
            logger.error(f"DynamoDB error validating token: {e}")
            raise TokenInvalidError("Token validation failed")

        items = response.get('Items', [])
        if not items:
            raise TokenInvalidError("Invalid access token")

        session = _strip_system_attrs(items[0])

        if int(time.time()) > session.get('expiresAt', 0):
            raise TokenExpiredError("Access token has expired")

        return session


# Singleton
_token_service: Optional[TokenService] = None


def get_token_service() -> TokenService:
    global _token_service
    if _token_service is None:
        _token_service = TokenService()
    return _token_service
