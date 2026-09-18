from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application configuration settings for the Support-Staff Console (svc-support).

    Reads/writes the SAME shared platform table (mz-platform-dev) as svc-tickets,
    so the item layout stays byte-compatible with the merchant view.
    """

    # Environment
    ENVIRONMENT: str = "development"

    # DynamoDB — shared platform single-table (tickets + messages + sessions live here)
    PLATFORM_TABLE_NAME: str = "mz-platform-dev"
    AWS_REGION: str = "ap-southeast-1"
    AWS_ENDPOINT_URL: Optional[str] = None  # For local DynamoDB

    # API
    API_V1_PREFIX: str = "/support/api"
    API_TITLE: str = "Mezzofy Support Console API"
    API_VERSION: str = "1.0.0"

    # Local dev port (mirrors svc-tickets' single-service serving; SPA served from public/)
    PORT: int = 8005

    # CORS — Vite dev server (5182), gateway (3030), and self
    CORS_ORIGINS: list[str] = [
        "http://localhost:5182",
        "http://localhost:3030",
        "http://localhost:8005",
    ]

    # Message / ticket validation (mirrors svc-tickets)
    MAX_ATTACHMENTS_PER_TICKET: int = 5
    MAX_ATTACHMENTS_PER_MESSAGE: int = 3
    MAX_FILE_SIZE_MB: int = 10
    SUBJECT_MIN_LENGTH: int = 3
    SUBJECT_MAX_LENGTH: int = 200
    DESCRIPTION_MIN_LENGTH: int = 10
    DESCRIPTION_MAX_LENGTH: int = 5000
    MESSAGE_MIN_LENGTH: int = 1
    MESSAGE_MAX_LENGTH: int = 2000

    class Config:
        env_file = ("../.env", ".env")
        case_sensitive = True


settings = Settings()
