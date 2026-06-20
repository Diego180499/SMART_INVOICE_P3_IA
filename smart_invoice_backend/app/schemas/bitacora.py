"""Schemas Pydantic para la bitácora de operaciones."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

EstadoBitacora = Literal["EXITOSO", "FALLIDO", "PENDIENTE"]


class BitacoraRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    factura_id: int | None = None
    usuario_id: int | None = None
    fecha_hora: datetime
    accion: str
    estado: EstadoBitacora
    resultado: str | None = None
    detalle: str | None = None
    created_at: datetime


class BitacoraList(BaseModel):
    total: int
    items: list[BitacoraRead]
