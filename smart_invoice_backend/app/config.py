"""Configuración central de la aplicación basada en variables de entorno.

Se utiliza Pydantic Settings para cargar y validar la configuración desde el
archivo `.env`. Todas las rutas de almacenamiento se resuelven de forma
absoluta respecto a la raíz del proyecto.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Parámetros de configuración cargados desde el entorno."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Aplicación ─────────────────────────────────────────────
    APP_NAME: str = "SmartInvoice API"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # ── Base de datos ──────────────────────────────────────────
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "smart_invoice"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    # ── Seguridad JWT ──────────────────────────────────────────
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ── Almacenamiento de archivos ─────────────────────────────
    UPLOAD_DIR: str = "uploads"
    REPORTS_DIR: str = "reports"
    MAX_FILE_SIZE_MB: int = 20

    # ── CORS ───────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── OCR / Tesseract ────────────────────────────────────────
    TESSERACT_CMD: str = ""
    POPPLER_PATH: str = ""
    OCR_LANG: str = "spa+eng"

    # ── SMTP ───────────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    EMAIL_FROM: str = "SmartInvoice <no-reply@smartinvoice.local>"

    # ── RPA ────────────────────────────────────────────────────
    RPA_FORM_URL: str = "http://localhost:3000/formulario-simulado"
    RPA_HEADLESS: bool = True

    # ── Propiedades derivadas ──────────────────────────────────
    @property
    def database_url(self) -> str:
        """Cadena de conexión SQLAlchemy para MySQL vía PyMySQL."""
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        """Lista de orígenes permitidos para CORS."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        path = BASE_DIR / self.UPLOAD_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def reports_path(self) -> Path:
        path = BASE_DIR / self.REPORTS_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de la configuración."""
    return Settings()


settings = get_settings()
