"""Router de reportes: /api/v1/reportes."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Query, status
from fastapi.responses import FileResponse

from app.config import BASE_DIR
from app.core.dependencies import AdminUser, CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.schemas.reporte import ReporteCreate, ReporteList, ReporteRead
from app.services import reporte_service

router = APIRouter(prefix="/reportes", tags=["Reportes"])

_MEDIA_TYPES = {
    "PDF": "application/pdf",
    "EXCEL": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "CSV": "text/csv",
}


@router.post("/generar", response_model=ReporteRead, status_code=status.HTTP_201_CREATED)
def generar(params: ReporteCreate, db: DbSession, current_user: CurrentUser):
    """Genera un reporte administrativo (PDF/EXCEL/CSV) con los filtros dados."""
    return reporte_service.generate(db, params, current_user.id)


@router.get("", response_model=ReporteList)
def listar(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Lista los reportes generados."""
    total, items = reporte_service.get_all(db, skip=skip, limit=limit)
    return ReporteList(total=total, items=items)


@router.get("/{reporte_id}", response_model=ReporteRead)
def obtener(reporte_id: int, db: DbSession, _: CurrentUser):
    """Metadatos de un reporte específico."""
    return reporte_service.get_by_id(db, reporte_id)


@router.get("/{reporte_id}/descargar")
def descargar(reporte_id: int, db: DbSession, _: CurrentUser):
    """Descarga el archivo físico del reporte."""
    reporte = reporte_service.get_by_id(db, reporte_id)
    ruta = BASE_DIR / reporte.ruta_archivo
    if not ruta.exists():
        raise NotFoundError("El archivo del reporte no existe en el disco.")
    return FileResponse(
        path=str(ruta),
        media_type=_MEDIA_TYPES.get(reporte.tipo, "application/octet-stream"),
        filename=Path(reporte.ruta_archivo).name,
    )


@router.delete("/{reporte_id}", status_code=status.HTTP_200_OK)
def eliminar(reporte_id: int, db: DbSession, _: AdminUser):
    """Elimina el reporte y su archivo (solo admin)."""
    reporte_service.delete(db, reporte_id)
    return {"detail": "Reporte eliminado correctamente."}
