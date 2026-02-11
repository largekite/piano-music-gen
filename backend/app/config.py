"""
Application configuration settings.
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # API Configuration
    API_TITLE: str = "Piano Music Generator API"
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    # Storage Paths
    STORAGE_PATH: str = "app/storage"
    GENERATED_MIDI_PATH: str = "app/storage/generated_midi"
    MAGENTA_MODELS_PATH: str = "app/storage/magenta_models"
    MAGENTA_OUTPUT_PATH: str = "magenta_output"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./app/storage/metadata.db"

    # HuggingFace Configuration
    HF_TOKEN: Optional[str] = None
    HF_PRIMARY_MODEL: str = "facebook/musicgen-small"
    HF_FALLBACK_MODEL: str = "sander-wood/music-transformer"

    # Magenta Configuration
    MAGENTA_BUNDLE_FILE: str = "app/storage/magenta_models/attention_rnn.mag"
    MAGENTA_CONFIG: str = "attention_rnn"
    MAGENTA_TEMPERATURE: float = 1.0
    MAGENTA_TIMEOUT: int = 300  # seconds

    # Generation Settings
    DEFAULT_TEMPO: int = 100
    MIN_TEMPO: int = 40
    MAX_TEMPO: int = 180

    # WebSocket Settings
    WS_HEARTBEAT_INTERVAL: int = 30  # seconds

    # File Settings
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = [".mid", ".midi"]

    # Pagination
    DEFAULT_PAGE_SIZE: int = 12
    MAX_PAGE_SIZE: int = 100

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()

# Ensure storage directories exist
os.makedirs(settings.STORAGE_PATH, exist_ok=True)
os.makedirs(settings.GENERATED_MIDI_PATH, exist_ok=True)
os.makedirs(settings.MAGENTA_MODELS_PATH, exist_ok=True)
os.makedirs(settings.MAGENTA_OUTPUT_PATH, exist_ok=True)
