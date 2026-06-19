"""Router de OCR y procesamiento: /api/v1/ocr."""
from __future__ import annotations

from fastapi import APIRouter, Body

from app.core.dependencies import AdminUser, CurrentUser, DbSession
from app.schemas.dato_extraido import DatoExtraidoRead
from app.services import ocr_service

router = APIRouter(prefix="/ocr", tags=["OCR / Procesamiento"])


@router.post("/procesar/{factura_id}", response_model=DatoExtraidoRead)
def procesar(factura_id: int, db: DbSession, current_user: CurrentUser):
    """Ejecuta el pipeline OCR completo para una factura."""
    return ocr_service.process_invoice(db, factura_id, current_user.id)


@router.post("/procesar-lote")
def procesar_lote(
    db: DbSession,
    admin: AdminUser,
    factura_ids: list[int] = Body(..., embed=True),
):
    """Procesa múltiples facturas en secuencia (solo admin)."""
    resultados = []
    for fid in factura_ids:
        try:
            dato = ocr_service.process_invoice(db, fid, admin.id)
            resultados.append({
                "factura_id": fid,
                "ok": True,
                "validado": bool(dato.validado),
            })
        except Exception as exc:  # noqa: BLE001
            resultados.append({"factura_id": fid, "ok": False, "error": str(exc)})
    return {"procesadas": len(resultados), "resultados": resultados}


@router.get("/estado/{factura_id}")
def estado(factura_id: int, db: DbSession, _: CurrentUser):
    """Consulta el estado de procesamiento de una factura."""
    return ocr_service.get_estado(db, factura_id)
