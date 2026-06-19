"""Configuración del motor SQLAlchemy y la sesión de base de datos.

Expone:
- ``engine``: motor de conexión a MySQL.
- ``SessionLocal``: fábrica de sesiones.
- ``Base``: clase declarativa base para los modelos ORM.
- ``get_db``: dependencia generadora de sesiones para FastAPI.
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,      # Verifica conexiones antes de usarlas (evita "MySQL has gone away")
    pool_recycle=3600,       # Recicla conexiones cada hora
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Clase base declarativa para todos los modelos ORM."""


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI que provee una sesión de BD por request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
