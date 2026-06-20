"""Servicio de facturas: carga, consulta, actualización de estado y borrado."""
from __future__ import annotations

from datetime import date, datetime, time

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import NotFoundError
from app.models.factura import Factura
from app.services import bitacora_service
from app.utils.file_handler import delete_file, save_upload_file


def upload(db: Session, file: UploadFile, usuario_id: int) -> Factura:
    """Guarda el archivo en disco y registra la factura en estado Pendiente."""
    nombre_almacenado, ruta_relativa, tipo_archivo = save_upload_file(file)

    factura = Factura(
        nombre_archivo_original=file.filename,
        nombre_archivo_almacenado=nombre_almacenado,
        ruta_archivo=ruta_relativa,
        tipo_archivo=tipo_archivo,
        estado="Pendiente",
        usuario_id=usuario_id,
    )
    db.add(factura)
    db.commit()
    db.refresh(factura)

    bitacora_service.log(
        db,
        accion="UPLOAD_FACTURA",
        estado="EXITOSO",
        factura_id=factura.id,
        usuario_id=usuario_id,
        resultado=f"Factura '{file.filename}' cargada correctamente.",
    )
    return factura


def get_all(
    db: Session,
    *,
    estado: str | None = None,
    proveedor_id: int | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[Factura]]:
    stmt = select(Factura)
    if estado:
        stmt = stmt.where(Factura.estado == estado)
    if proveedor_id is not None:
        stmt = stmt.where(Factura.proveedor_id == proveedor_id)
    if fecha_inicio:
        stmt = stmt.where(Factura.created_at >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin:
        stmt = stmt.where(Factura.created_at <= datetime.combine(fecha_fin, time.max))

    total = len(list(db.scalars(stmt).all()))
    stmt = stmt.order_by(Factura.created_at.desc()).offset(skip).limit(limit)
    return total, list(db.scalars(stmt).all())


def get_by_id(db: Session, factura_id: int, *, with_details: bool = False) -> Factura:
    if with_details:
        stmt = (
            select(Factura)
            .options(
                joinedload(Factura.proveedor),
                joinedload(Factura.datos_extraidos),
            )
            .where(Factura.id == factura_id)
        )
        factura = db.scalar(stmt)
    else:
        factura = db.get(Factura, factura_id)

    if not factura:
        raise NotFoundError("Factura no encontrada.")
    return factura


def update_estado(db: Session, factura_id: int, estado: str) -> Factura:
    factura = get_by_id(db, factura_id)
    factura.estado = estado
    db.commit()
    db.refresh(factura)
    return factura


def delete(db: Session, factura_id: int, usuario_id: int | None = None) -> bool:
    """Elimina el registro de la factura y su archivo físico del disco."""
    factura = get_by_id(db, factura_id)
    ruta = factura.ruta_archivo
    nombre_original = factura.nombre_archivo_original

    db.delete(factura)
    db.commit()

    delete_file(ruta)
    bitacora_service.log(
        db,
        accion="UPLOAD_FACTURA",
        estado="EXITOSO",
        usuario_id=usuario_id,
        resultado=f"Factura '{nombre_original}' (ID {factura_id}) eliminada.",
    )
    return True
