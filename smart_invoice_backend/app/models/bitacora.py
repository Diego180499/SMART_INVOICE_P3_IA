"""Modelo ORM de la tabla ``bitacora`` (auditoría de operaciones)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

ESTADO_BITACORA = ("EXITOSO", "FALLIDO", "PENDIENTE")

# Catálogo de acciones registrables en la bitácora.
ACCIONES = (
    "UPLOAD_FACTURA",
    "OCR_PROCESO",
    "EXTRACCION_DATOS",
    "VALIDACION_DATOS",
    "ALMACENAMIENTO_DATOS",
    "GENERACION_REPORTE",
    "ENVIO_EMAIL",
    "RPA_FORMULARIO",
    "LOGIN",
    "CRUD_PROVEEDOR",
)


class Bitacora(Base):
    __tablename__ = "bitacora"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    factura_id: Mapped[int | None] = mapped_column(
        ForeignKey("facturas.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    accion: Mapped[str] = mapped_column(String(100), nullable=False)
    estado: Mapped[str] = mapped_column(
        Enum(*ESTADO_BITACORA, name="bitacora_estado"), nullable=False
    )
    resultado: Mapped[str | None] = mapped_column(Text, nullable=True)
    detalle: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relaciones
    factura: Mapped["Factura | None"] = relationship(back_populates="bitacoras")  # noqa: F821
    usuario: Mapped["User | None"] = relationship(back_populates="bitacoras")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Bitacora id={self.id} accion={self.accion!r} estado={self.estado!r}>"
