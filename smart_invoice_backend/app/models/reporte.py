"""Modelo ORM de la tabla ``reportes``."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TIPO_REPORTE = ("PDF", "EXCEL", "CSV")


class Reporte(Base):
    __tablename__ = "reportes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[str] = mapped_column(
        Enum(*TIPO_REPORTE, name="reporte_tipo"), nullable=False
    )
    ruta_archivo: Mapped[str] = mapped_column(String(500), nullable=False)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    fecha_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_fin: Mapped[date | None] = mapped_column(Date, nullable=True)
    proveedor_id: Mapped[int | None] = mapped_column(
        ForeignKey("proveedores.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    total_facturas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relaciones
    usuario: Mapped["User"] = relationship(back_populates="reportes")  # noqa: F821
    proveedor: Mapped["Proveedor | None"] = relationship()  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Reporte id={self.id} tipo={self.tipo!r}>"
