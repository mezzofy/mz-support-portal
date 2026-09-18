import logging
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from core.config import settings

logger = logging.getLogger(__name__)


class DynamoDBClient:
    """DynamoDB client wrapper for Support module.

    Vendored unchanged from svc-tickets so support writes stay byte-compatible
    with the merchant view of the shared mz-platform-dev table.
    """

    def __init__(self):
        boto_config = Config(
            region_name=settings.AWS_REGION,
            retries={'max_attempts': 3, 'mode': 'adaptive'}
        )

        if settings.AWS_ENDPOINT_URL:
            # Local DynamoDB for testing
            self._client = boto3.client(
                'dynamodb',
                endpoint_url=settings.AWS_ENDPOINT_URL,
                config=boto_config
            )
            self._resource = boto3.resource(
                'dynamodb',
                endpoint_url=settings.AWS_ENDPOINT_URL,
                config=boto_config
            )
        else:
            # Production DynamoDB
            self._client = boto3.client('dynamodb', config=boto_config)
            self._resource = boto3.resource('dynamodb', config=boto_config)

    def get_platform_table(self):
        """Get the central platform single-table DynamoDB resource"""
        return self._resource.Table(settings.PLATFORM_TABLE_NAME)

    @property
    def client(self):
        """Get low-level DynamoDB client"""
        return self._client

    @property
    def resource(self):
        """Get high-level DynamoDB resource"""
        return self._resource


# Singleton instance
db_client = DynamoDBClient()
