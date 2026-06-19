"""Router de automatización RPA: /api/v1/rpa."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import CurrentUser, DbSession
from app.schemas.bitacora import BitacoraRead
from app.schemas.reporte import EnvioReporteRequest
from app.services import bitacora_service, rpa_service

router = APIRouter(prefix="/rpa", tags=["RPA / Automatización"])


@router.post("/registrar-formulario/{factura_id}")
def registrar_formulario(factura_id: int, db: DbSession, current_user: CurrentUser):
    """Ejecuta RPA: llena un formulario web con los datos de la factura."""
    return rpa_service.register_in_form(db, factura_id, current_user.id)


@router.post("/enviar-reporte/{reporte_id}")
def enviar_reporte(
    reporte_id: int,
    payload: EnvioReporteRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Ejecuta la automatización de envío de un reporte por correo electrónico."""
    return rpa_service.send_report_via_rpa(
        db, reporte_id, payload.destinatario, current_user.id
    )


@router.get("/historial", response_model=list[BitacoraRead])
def historial(db: DbSession, _: CurrentUser):
    """Lista las ejecuciones RPA pasadas (desde la bitácora)."""
    historial: list = []
    for accion in ("RPA_FORMULARIO", "ENVIO_EMAIL"):
        _, items = bitacora_service.get_all(db, accion=accion, limit=200)
        historial.extend(items)
    historial.sort(key=lambda b: b.fecha_hora, reverse=True)
    return historial
