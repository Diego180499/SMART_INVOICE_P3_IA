"""Schemas Pydantic para los datos extraídos por OCR."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DatoExtraidoBase(BaseModel):
    numero_factura: str | None = Field(default=None, max_length=100)
    fecha_factura: date | None = None
    nombre_proveedor_ocr: str | None = Field(default=None, max_length=255)
    nit_ocr: str | None = Field(default=None, max_length=50)
    subtotal: Decimal | None = None
    impuestos: Decimal | None = None
    total: Decimal | None = None


class DatoExtraidoUpdate(DatoExtraidoBase):
    """Permite la corrección manual de los campos extraídos."""

    validado: bool | None = None
    observaciones_validacion: str | None = None


class DatoExtraidoRead(DatoExtraidoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    factura_id: int
    texto_raw: str | None = None
    confianza_ocr: float | None = None
    validado: bool
    observaciones_validacion: str | None = None
    created_at: datetime
    updated_at: datetime
