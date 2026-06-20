"""Schemas Pydantic para reportes administrativos."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TipoReporte = Literal["PDF", "EXCEL", "CSV"]


class ReporteCreate(BaseModel):
    tipo: TipoReporte = "PDF"
    nombre: str | None = Field(
        default=None,
        max_length=255,
        description="Nombre descriptivo; si se omite se genera automáticamente.",
    )
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    proveedor_id: int | None = None
    incluir_rechazados: bool = False


class ReporteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    tipo: TipoReporte
    ruta_archivo: str
    usuario_id: int
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    proveedor_id: int | None = None
    total_facturas: int | None = None
    created_at: datetime


class ReporteList(BaseModel):
    total: int
    items: list[ReporteRead]


class EnvioReporteRequest(BaseModel):
    destinatario: str = Field(..., description="Correo electrónico del destinatario")
