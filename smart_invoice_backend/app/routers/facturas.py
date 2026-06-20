"""Router de facturas: /api/v1/facturas."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, File, Query, UploadFile, status

from app.core.dependencies import AdminUser, CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.schemas.dato_extraido import DatoExtraidoRead, DatoExtraidoUpdate
from app.schemas.factura import (
    FacturaDetail,
    FacturaList,
    FacturaUploadResponse,
)
from app.services import factura_service

router = APIRouter(prefix="/facturas", tags=["Facturas"])


@router.post("/upload", response_model=FacturaUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_factura(
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    """Carga un archivo de factura (PDF/JPG/JPEG/PNG)."""
    factura = factura_service.upload(db, file, current_user.id)
    return FacturaUploadResponse(
        id=factura.id,
        nombre_archivo_original=factura.nombre_archivo_original,
        tipo_archivo=factura.tipo_archivo,
        estado=factura.estado,
    )


@router.get("", response_model=FacturaList)
def listar(
    db: DbSession,
    _: CurrentUser,
    estado: str | None = Query(None),
    proveedor_id: int | None = Query(None),
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Lista facturas con filtros por estado, proveedor y rango de fechas."""
    total, items = factura_service.get_all(
        db, estado=estado, proveedor_id=proveedor_id,
        fecha_inicio=fecha_inicio, fecha_fin=fecha_fin,
        skip=skip, limit=limit,
    )
    return FacturaList(total=total, items=items)


@router.get("/{factura_id}", response_model=FacturaDetail)
def obtener(factura_id: int, db: DbSession, _: CurrentUser):
    """Detalle completo de una factura, incluyendo datos extraídos y proveedor."""
    return factura_service.get_by_id(db, factura_id, with_details=True)


@router.get("/{factura_id}/datos", response_model=DatoExtraidoRead)
def obtener_datos(factura_id: int, db: DbSession, _: CurrentUser):
    """Obtiene solo los datos extraídos por OCR de la factura."""
    factura = factura_service.get_by_id(db, factura_id, with_details=True)
    if not factura.datos_extraidos:
        raise NotFoundError("La factura aún no tiene datos extraídos.")
    return factura.datos_extraidos


@router.put("/{factura_id}/datos", response_model=DatoExtraidoRead)
def actualizar_datos(
    factura_id: int, data: DatoExtraidoUpdate, db: DbSession, _: CurrentUser
):
    """Corrección manual de los datos extraídos de una factura."""
    factura = factura_service.get_by_id(db, factura_id, with_details=True)
    if not factura.datos_extraidos:
        raise NotFoundError("La factura aún no tiene datos extraídos.")

    dato = factura.datos_extraidos
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "validado" and value is not None:
            dato.validado = 1 if value else 0
        else:
            setattr(dato, field, value)
    db.commit()
    db.refresh(dato)
    return dato


@router.delete("/{factura_id}", status_code=status.HTTP_200_OK)
def eliminar(factura_id: int, db: DbSession, admin: AdminUser):
    """Elimina la factura y su archivo del disco (solo admin)."""
    factura_service.delete(db, factura_id, usuario_id=admin.id)
    return {"detail": "Factura eliminada correctamente."}
