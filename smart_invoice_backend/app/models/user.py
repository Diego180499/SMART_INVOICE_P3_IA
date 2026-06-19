"""Modelo ORM de la tabla ``users``."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(
        Enum("admin", "usuario", name="user_rol"),
        nullable=False,
        default="usuario",
    )
    activo: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relaciones
    facturas: Mapped[list["Factura"]] = relationship(back_populates="usuario")  # noqa: F821
    bitacoras: Mapped[list["Bitacora"]] = relationship(back_populates="usuario")  # noqa: F821
    reportes: Mapped[list["Reporte"]] = relationship(back_populates="usuario")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email!r} rol={self.rol!r}>"
