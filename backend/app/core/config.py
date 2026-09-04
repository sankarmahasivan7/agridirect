"""
Central application configuration, loaded from environment variables (.env).
Nothing here is hard-coded business/marketplace data -- only infrastructure
and platform-fee CONFIGURATION, which is explicitly allowed to be configured
(see spec section 29 - Business Model).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./agridirect.db"

    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    PLATFORM_FEE_PERCENT: float = 2.0
    LOGISTICS_BASE_RATE_PER_KG: float = 4.0

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    ADMIN_EMAIL: str = "admin@agridirect.ai"
    ADMIN_PASSWORD: str = "change-this-admin-password"


settings = Settings()
