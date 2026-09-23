"""JWT validation service — validates mz-ai-assistant access tokens (Option B).

Re-platformed from the DynamoDB opaque-token (GSI1 TOKEN#) lookup. svc-support
reuses the mz-ai-assistant JWT: HS256, signed with the SHARED `JWT_SECRET`.
Validation is stateless local decode (parity with the mz-ai server, which does
not consult Redis on the access-token path). Returns the decoded claims.
"""
import logging
from typing import Dict, Optional

from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from core.config import settings
from core.errors import TokenExpiredError, TokenInvalidError

logger = logging.getLogger(__name__)


class TokenService:
    """Validate a mz-ai-assistant access token and return its claims.

    Access-token claims include: user_id, email, name, department, role,
    permissions, token_type, jti, iat, exp.
    """

    def validate_access_token(self, access_token: str) -> Dict:
        """Decode + validate a JWT access token.

        Raises:
            TokenExpiredError: signature/exp expired.
            TokenInvalidError: bad signature, malformed, or not an access token.
        """
        try:
            claims = jwt.decode(
                access_token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except ExpiredSignatureError:
            raise TokenExpiredError("Access token has expired")
        except JWTError as e:
            logger.debug("JWT validation failed: %s", e)
            raise TokenInvalidError("Invalid access token")

        if claims.get("token_type") != "access":
            raise TokenInvalidError("Not an access token")

        return claims


# Singleton
_token_service: Optional[TokenService] = None


def get_token_service() -> TokenService:
    global _token_service
    if _token_service is None:
        _token_service = TokenService()
    return _token_service
