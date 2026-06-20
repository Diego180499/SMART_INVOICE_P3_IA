"""Schemas Pydantic para facturas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.dato_extraido import DatoExtraidoRead
from app.schemas.proveedor import ProveedorRead

EstadoFactura = Literal["Pendiente", "Procesado", "Error", "Rechazado"]
TipoArchivo = Literal["PDF", "JPG", "JPEG", "PNG"]


class FacturaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_archivo_original: str
    nombre_archivo_almacenado: str
    ruta_archivo: str
    tipo_archivo: TipoArchivo
    estado: EstadoFactura
    proveedor_id: int | None = None
    usuario_id: int
    created_at: datetime
    updated_at: datetime


class FacturaDetail(FacturaRead):
    """Detalle completo de una factura incluyendo datos extraídos y proveedor."""

    proveedor: ProveedorRead | None = None
    datos_extraidos: DatoExtraidoRead | None = None


class FacturaList(BaseModel):
    total: int
    items: list[FacturaRead]


class FacturaUploadResponse(BaseModel):
    id: int
    nombre_archivo_original: str
    tipo_archivo: TipoArchivo
    estado: EstadoFactura
    mensaje: str = "Factura cargada correctamente. Lista para procesamiento OCR."
