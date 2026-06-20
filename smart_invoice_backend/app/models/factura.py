"""Modelo ORM de la tabla ``facturas``."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TIPO_ARCHIVO = ("PDF", "JPG", "JPEG", "PNG")
ESTADO_FACTURA = ("Pendiente", "Procesado", "Error", "Rechazado")


class Factura(Base):
    __tablename__ = "facturas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_archivo_original: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre_archivo_almacenado: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )
    ruta_archivo: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo_archivo: Mapped[str] = mapped_column(
        Enum(*TIPO_ARCHIVO, name="factura_tipo"), nullable=False
    )
    estado: Mapped[str] = mapped_column(
        Enum(*ESTADO_FACTURA, name="factura_estado"),
        nullable=False,
        default="Pendiente",
    )
    proveedor_id: Mapped[int | None] = mapped_column(
        ForeignKey("proveedores.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relaciones
    proveedor: Mapped["Proveedor | None"] = relationship(back_populates="facturas")  # noqa: F821
    usuario: Mapped["User"] = relationship(back_populates="facturas")  # noqa: F821
    datos_extraidos: Mapped["DatoExtraido | None"] = relationship(  # noqa: F821
        back_populates="factura", cascade="all, delete-orphan", uselist=False
    )
    bitacoras: Mapped[list["Bitacora"]] = relationship(back_populates="factura")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Factura id={self.id} estado={self.estado!r}>"
