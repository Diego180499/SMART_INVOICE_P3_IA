"""Schemas Pydantic para proveedores."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProveedorBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=255)
    nit: str = Field(..., min_length=2, max_length=50)
    direccion: str | None = Field(default=None, max_length=500)
    telefono: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=255)
    nit: str | None = Field(default=None, min_length=2, max_length=50)
    direccion: str | None = Field(default=None, max_length=500)
    telefono: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    activo: bool | None = None


class ProveedorRead(ProveedorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activo: bool
    created_at: datetime
    updated_at: datetime


class ProveedorList(BaseModel):
    total: int
    items: list[ProveedorRead]
