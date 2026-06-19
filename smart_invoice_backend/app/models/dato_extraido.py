"""Modelo ORM de la tabla ``datos_extraidos`` (relación 1:1 con facturas)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    DECIMAL,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.mysql import LONGTEXT, TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DatoExtraido(Base):
    __tablename__ = "datos_extraidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    factura_id: Mapped[int] = mapped_column(
        ForeignKey("facturas.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,
    )
    numero_factura: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fecha_factura: Mapped[date | None] = mapped_column(Date, nullable=True)
    nombre_proveedor_ocr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nit_ocr: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subtotal: Mapped[Decimal | None] = mapped_column(DECIMAL(14, 2), nullable=True)
    impuestos: Mapped[Decimal | None] = mapped_column(DECIMAL(14, 2), nullable=True)
    total: Mapped[Decimal | None] = mapped_column(DECIMAL(14, 2), nullable=True)
    texto_raw: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)
    confianza_ocr: Mapped[float | None] = mapped_column(Float, nullable=True)
    validado: Mapped[int] = mapped_column(TINYINT(1), nullable=False, default=0)
    observaciones_validacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relaciones
    factura: Mapped["Factura"] = relationship(back_populates="datos_extraidos")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<DatoExtraido id={self.id} factura_id={self.factura_id}>"
