"""Punto de entrada de la API SmartInvoice (FastAPI).

Configura la instancia FastAPI, CORS, manejadores de excepciones, eventos de
ciclo de vida y registra todos los routers de dominio.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.database import engine
from app.routers import (
    auth,
    bitacora,
    facturas,
    ocr,
    proveedores,
    reportes,
    rpa,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("smartinvoice")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Ciclo de vida: verifica la conexión a la BD al arrancar."""
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.reports_path.mkdir(parents=True, exist_ok=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Conexión a la base de datos '%s' verificada.", settings.DB_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.error("No se pudo conectar a la base de datos: %s", exc)
    yield
    logger.info("Cerrando SmartInvoice API.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "API REST de **SmartInvoice**: procesamiento inteligente de facturas con "
        "OCR (Tesseract + OpenCV), validación automática, reportes y automatización RPA."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Registro de routers bajo el prefijo común /api/v1
for router in (auth, proveedores, facturas, ocr, bitacora, reportes, rpa):
    app.include_router(router.router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Salud"])
def root():
    """Endpoint raíz informativo."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "api_prefix": settings.API_PREFIX,
    }


@app.get("/health", tags=["Salud"])
def health():
    """Healthcheck: verifica la conectividad con la base de datos."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}
