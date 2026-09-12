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

    # Configurable Logistics Pricing Rules
    LOGISTICS_BASE_DISPATCH_FEE: float = 30.0          # Flat base dispatch fee (₹)
    LOGISTICS_RATE_PER_KM: float = 2.5                 # Rate per km (₹/km)
    LOGISTICS_RATE_PER_KG: float = 1.5                 # Weight rate per kg (₹/kg)
    LOGISTICS_CONSOLIDATION_DISCOUNT_PCT: float = 20.0 # Multi-order consolidated delivery discount (%)
    LOGISTICS_LONG_DISTANCE_THRESHOLD_KM: float = 80.0 # Distance threshold (km) for aggregation hub routing

    FRONTEND_ORIGIN: str = "http://localhost:5173"
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"

    ADMIN_EMAIL: str = "admin@agridirect.ai"
    ADMIN_PASSWORD: str = "change-this-admin-password"

    # Razorpay Payment Gateway (Test Mode)
    RAZORPAY_KEY_ID: str = "rzp_test_TZrzdQ5wla6foh"
    RAZORPAY_KEY_SECRET: str = "px6y7Nf1o1xkWFrU9g6h62Xc"

    # UPI QR Payment Settings (Scan & Pay with GPay, PhonePe, Paytm, BHIM)
    DEFAULT_UPI_ID: str = "8870862195@axl"
    DEFAULT_UPI_NAME: str = "SEYED MOHAMMED SAFIN"

    # Real Road Mapping & Routing (Google Maps API with OSRM Fallback)
    GOOGLE_MAPS_API_KEY: str | None = None
    ROUTING_PROVIDER: str = "auto"  # 'auto' (Google Maps if key present, else OSRM), 'google', 'osrm', 'haversine'

    # Gemini AI Decision Layer & Voice Assistant
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-flash-latest"


settings = Settings()
