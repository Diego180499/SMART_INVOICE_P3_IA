"""Router de proveedores: /api/v1/proveedores."""
from __future__ import annotations

from fastapi import APIRouter, Query, status

from app.core.dependencies import AdminUser, CurrentUser, DbSession
from app.schemas.proveedor import (
    ProveedorCreate,
    ProveedorList,
    ProveedorRead,
    ProveedorUpdate,
)
from app.services import bitacora_service, proveedor_service

router = APIRouter(prefix="/proveedores", tags=["Proveedores"])


@router.get("", response_model=ProveedorList)
def listar(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    solo_activos: bool = True,
):
    """Lista proveedores (paginado)."""
    total, items = proveedor_service.get_all(
        db, skip=skip, limit=limit, solo_activos=solo_activos
    )
    return ProveedorList(total=total, items=items)


@router.get("/buscar", response_model=list[ProveedorRead])
def buscar(q: str, db: DbSession, _: CurrentUser):
    """Busca proveedores por nombre o NIT."""
    return proveedor_service.search(db, q)


@router.get("/{proveedor_id}", response_model=ProveedorRead)
def obtener(proveedor_id: int, db: DbSession, _: CurrentUser):
    """Obtiene un proveedor por su ID."""
    return proveedor_service.get_by_id(db, proveedor_id)


@router.post("", response_model=ProveedorRead, status_code=status.HTTP_201_CREATED)
def crear(data: ProveedorCreate, db: DbSession, admin: AdminUser):
    """Crea un nuevo proveedor (solo admin)."""
    proveedor = proveedor_service.create(db, data)
    bitacora_service.log(
        db, accion="CRUD_PROVEEDOR", estado="EXITOSO",
        usuario_id=admin.id,
        resultado=f"Proveedor '{proveedor.nombre}' creado (ID {proveedor.id}).",
    )
    return proveedor


@router.put("/{proveedor_id}", response_model=ProveedorRead)
def actualizar(proveedor_id: int, data: ProveedorUpdate, db: DbSession, admin: AdminUser):
    """Actualiza un proveedor existente (solo admin)."""
    proveedor = proveedor_service.update(db, proveedor_id, data)
    bitacora_service.log(
        db, accion="CRUD_PROVEEDOR", estado="EXITOSO",
        usuario_id=admin.id,
        resultado=f"Proveedor ID {proveedor_id} actualizado.",
    )
    return proveedor


@router.delete("/{proveedor_id}", status_code=status.HTTP_200_OK)
def eliminar(proveedor_id: int, db: DbSession, admin: AdminUser):
    """Desactiva un proveedor (soft-delete, solo admin)."""
    proveedor_service.soft_delete(db, proveedor_id)
    bitacora_service.log(
        db, accion="CRUD_PROVEEDOR", estado="EXITOSO",
        usuario_id=admin.id,
        resultado=f"Proveedor ID {proveedor_id} desactivado.",
    )
    return {"detail": "Proveedor desactivado correctamente."}
