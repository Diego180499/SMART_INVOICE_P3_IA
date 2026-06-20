"""Router de bitácora: /api/v1/bitacora."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from app.core.dependencies import CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.schemas.bitacora import BitacoraList, BitacoraRead
from app.services import bitacora_service

router = APIRouter(prefix="/bitacora", tags=["Bitácora"])


@router.get("", response_model=BitacoraList)
def listar(
    db: DbSession,
    _: CurrentUser,
    accion: str | None = Query(None),
    estado: str | None = Query(None),
    usuario_id: int | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Lista entradas de la bitácora con filtros."""
    total, items = bitacora_service.get_all(
        db, accion=accion, estado=estado, usuario_id=usuario_id,
        fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, skip=skip, limit=limit,
    )
    return BitacoraList(total=total, items=items)


@router.get("/factura/{factura_id}", response_model=list[BitacoraRead])
def por_factura(factura_id: int, db: DbSession, _: CurrentUser):
    """Historial completo de una factura específica."""
    return bitacora_service.get_by_factura(db, factura_id)


@router.get("/{bitacora_id}", response_model=BitacoraRead)
def obtener(bitacora_id: int, db: DbSession, _: CurrentUser):
    """Detalle de una entrada de bitácora."""
    entrada = bitacora_service.get_by_id(db, bitacora_id)
    if not entrada:
        raise NotFoundError("Entrada de bitácora no encontrada.")
    return entrada
