"""Servicio de bitácora: escritura y consulta del registro de auditoría."""
from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bitacora import Bitacora


def log(
    db: Session,
    *,
    accion: str,
    estado: str,
    factura_id: int | None = None,
    usuario_id: int | None = None,
    resultado: str | None = None,
    detalle: str | None = None,
    commit: bool = True,
) -> Bitacora:
    """Inserta una entrada en la bitácora.

    Si ``commit`` es False, el registro queda pendiente para que el llamador
    controle la transacción (útil para agrupar múltiples logs del pipeline).
    """
    entrada = Bitacora(
        accion=accion,
        estado=estado,
        factura_id=factura_id,
        usuario_id=usuario_id,
        resultado=resultado,
        detalle=detalle,
    )
    db.add(entrada)
    if commit:
        db.commit()
        db.refresh(entrada)
    else:
        db.flush()
    return entrada


def get_by_factura(db: Session, factura_id: int) -> list[Bitacora]:
    stmt = (
        select(Bitacora)
        .where(Bitacora.factura_id == factura_id)
        .order_by(Bitacora.fecha_hora.asc())
    )
    return list(db.scalars(stmt).all())


def get_by_id(db: Session, bitacora_id: int) -> Bitacora | None:
    return db.get(Bitacora, bitacora_id)


def get_all(
    db: Session,
    *,
    accion: str | None = None,
    estado: str | None = None,
    usuario_id: int | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[Bitacora]]:
    """Lista entradas con filtros opcionales. Devuelve (total, items)."""
    stmt = select(Bitacora)
    if accion:
        stmt = stmt.where(Bitacora.accion == accion)
    if estado:
        stmt = stmt.where(Bitacora.estado == estado)
    if usuario_id is not None:
        stmt = stmt.where(Bitacora.usuario_id == usuario_id)
    if fecha_inicio:
        stmt = stmt.where(Bitacora.fecha_hora >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin:
        stmt = stmt.where(Bitacora.fecha_hora <= datetime.combine(fecha_fin, time.max))

    total = len(list(db.scalars(stmt).all()))
    stmt = stmt.order_by(Bitacora.fecha_hora.desc()).offset(skip).limit(limit)
    items = list(db.scalars(stmt).all())
    return total, items
