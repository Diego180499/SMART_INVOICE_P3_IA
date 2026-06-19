"""Servicio CRUD de proveedores."""
from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.proveedor import Proveedor
from app.schemas.proveedor import ProveedorCreate, ProveedorUpdate


def get_all(
    db: Session, *, skip: int = 0, limit: int = 50, solo_activos: bool = True
) -> tuple[int, list[Proveedor]]:
    stmt = select(Proveedor)
    if solo_activos:
        stmt = stmt.where(Proveedor.activo == 1)

    total = len(list(db.scalars(stmt).all()))
    stmt = stmt.order_by(Proveedor.nombre.asc()).offset(skip).limit(limit)
    return total, list(db.scalars(stmt).all())


def get_by_id(db: Session, proveedor_id: int) -> Proveedor:
    proveedor = db.get(Proveedor, proveedor_id)
    if not proveedor:
        raise NotFoundError("Proveedor no encontrado.")
    return proveedor


def get_by_nit(db: Session, nit: str) -> Proveedor | None:
    return db.scalar(select(Proveedor).where(Proveedor.nit == nit))


def create(db: Session, data: ProveedorCreate) -> Proveedor:
    if get_by_nit(db, data.nit):
        raise ConflictError("Ya existe un proveedor con ese NIT.")

    proveedor = Proveedor(
        nombre=data.nombre,
        nit=data.nit,
        direccion=data.direccion,
        telefono=data.telefono,
        email=data.email,
        activo=1,
    )
    db.add(proveedor)
    db.commit()
    db.refresh(proveedor)
    return proveedor


def update(db: Session, proveedor_id: int, data: ProveedorUpdate) -> Proveedor:
    proveedor = get_by_id(db, proveedor_id)

    if data.nit and data.nit != proveedor.nit:
        existente = get_by_nit(db, data.nit)
        if existente and existente.id != proveedor_id:
            raise ConflictError("Ya existe otro proveedor con ese NIT.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "activo" and value is not None:
            setattr(proveedor, field, 1 if value else 0)
        else:
            setattr(proveedor, field, value)

    db.commit()
    db.refresh(proveedor)
    return proveedor


def soft_delete(db: Session, proveedor_id: int) -> bool:
    """Desactiva el proveedor (activo=0) sin borrarlo físicamente."""
    proveedor = get_by_id(db, proveedor_id)
    proveedor.activo = 0
    db.commit()
    return True


def search(db: Session, query: str) -> list[Proveedor]:
    """Busca proveedores por coincidencia parcial en nombre o NIT."""
    like = f"%{query}%"
    stmt = (
        select(Proveedor)
        .where(or_(Proveedor.nombre.ilike(like), Proveedor.nit.ilike(like)))
        .order_by(Proveedor.nombre.asc())
    )
    return list(db.scalars(stmt).all())
