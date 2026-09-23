from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration for the Support-Staff Console (svc-support).

    Re-platformed to PostgreSQL (Option B) — reads/writes the SAME `mezzofy_ai`
    database used by the mz-ai-assistant server (tickets/messages/merchants tables).
    Auth reuses mz-ai-assistant JWTs (shared JWT_SECRET); no DynamoDB, no svc-iam.
    """

    # Environment
    ENVIRONMENT: str = "development"

    # PostgreSQL — the shared mezzofy_ai database.
    # Accepts the mz-ai-assistant DATABASE_URL verbatim (SQLAlchemy async form);
    # core.database normalizes it to a libpq DSN for psycopg2.
    DATABASE_URL: str = "postgresql+asyncpg://mezzofy_ai:password@localhost:5432/mezzofy_ai"
    DB_POOL_MIN: int = 1
    DB_POOL_MAX: int = 10

    # Auth — reuse the mz-ai-assistant JWT (Option B). JWT_SECRET MUST match the
    # mz-ai-assistant server's value so svc-support can validate its access tokens.
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    # API
    API_V1_PREFIX: str = "/support/api"
    API_TITLE: str = "Mezzofy Support Console API"
    API_VERSION: str = "1.0.0"

    # Local dev port (svc-support serves API + the SPA from public/)
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
