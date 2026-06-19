"""Excepciones de dominio y manejadores globales de errores HTTP."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

logger = logging.getLogger("smartinvoice")


class AppException(Exception):
    """Excepción base de la aplicación con código HTTP y detalle."""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class NotFoundError(AppException):
    def __init__(self, detail: str = "Recurso no encontrado"):
        super().__init__(detail, status.HTTP_404_NOT_FOUND)


class ConflictError(AppException):
    def __init__(self, detail: str = "Conflicto con el estado actual del recurso"):
        super().__init__(detail, status.HTTP_409_CONFLICT)


class ValidationError(AppException):
    def __init__(self, detail: str = "Datos inválidos"):
        super().__init__(detail, status.HTTP_422_UNPROCESSABLE_ENTITY)


def register_exception_handlers(app: FastAPI) -> None:
    """Registra los manejadores globales de excepciones en la app."""

    @app.exception_handler(AppException)
    async def _app_exception_handler(_: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(IntegrityError)
    async def _integrity_error_handler(_: Request, exc: IntegrityError):
        logger.warning("Error de integridad en BD: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "Violación de integridad: el registro ya existe o "
                "referencia datos inexistentes."
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def _sqlalchemy_error_handler(_: Request, exc: SQLAlchemyError):
        logger.error("Error de base de datos: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Error interno de base de datos."},
        )
