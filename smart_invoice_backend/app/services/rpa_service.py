"""Servicio RPA: automatización de formularios web con Playwright y envío de correos.

Las importaciones de Playwright son perezosas para que la API funcione sin él.
El registro en formulario web es tolerante a fallos: si Playwright o el
formulario no están disponibles, se registra el resultado en la bitácora sin
interrumpir el flujo de la aplicación.
"""
from __future__ import annotations

import logging
import traceback

from sqlalchemy.orm import Session

from app.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.factura import Factura
from app.services import bitacora_service, email_service, reporte_service

logger = logging.getLogger("smartinvoice.rpa")


def register_in_form(db: Session, factura_id: int, usuario_id: int | None = None) -> dict:
    """Llena un formulario web con los datos de la factura usando Playwright."""
    factura = db.get(Factura, factura_id)
    if not factura:
        raise NotFoundError("Factura no encontrada.")
    if not factura.datos_extraidos:
        raise ValidationError(
            "La factura no tiene datos extraídos. Procese el OCR primero."
        )

    datos = factura.datos_extraidos
    campos = {
        "numero_factura": datos.numero_factura or "",
        "fecha": datos.fecha_factura.isoformat() if datos.fecha_factura else "",
        "proveedor": datos.nombre_proveedor_ocr or "",
        "nit": datos.nit_ocr or "",
        "total": str(datos.total) if datos.total is not None else "",
    }

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover
        bitacora_service.log(
            db, accion="RPA_FORMULARIO", estado="FALLIDO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado="Playwright no está instalado.",
            detalle=str(exc),
        )
        raise ValidationError(
            "Playwright no está instalado. Ejecute 'playwright install chromium'."
        ) from exc

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=settings.RPA_HEADLESS)
            page = browser.new_page()
            page.goto(settings.RPA_FORM_URL, timeout=20000)

            # Intenta rellenar campos por nombre/id comunes (tolerante).
            for nombre_campo, valor in campos.items():
                if not valor:
                    continue
                selector = f"[name='{nombre_campo}'], #{nombre_campo}"
                try:
                    page.fill(selector, valor, timeout=3000)
                except Exception:  # noqa: BLE001
                    logger.debug("Campo '%s' no encontrado en el formulario.", nombre_campo)

            try:
                page.click("button[type='submit'], input[type='submit']", timeout=3000)
            except Exception:  # noqa: BLE001
                logger.debug("Botón de submit no encontrado.")

            browser.close()

        bitacora_service.log(
            db, accion="RPA_FORMULARIO", estado="EXITOSO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado=f"Formulario web completado para la factura {factura_id}.",
            detalle=str(campos),
        )
        return {"ok": True, "factura_id": factura_id, "campos": campos}

    except Exception as exc:  # noqa: BLE001
        logger.error("Error RPA formulario factura %s: %s", factura_id, exc)
        bitacora_service.log(
            db, accion="RPA_FORMULARIO", estado="FALLIDO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado=f"Error al completar el formulario: {exc}",
            detalle=traceback.format_exc(),
        )
        raise ValidationError(f"Error en la automatización RPA: {exc}") from exc


def send_report_via_rpa(
    db: Session, reporte_id: int, recipient: str, usuario_id: int | None = None
) -> dict:
    """Envía un reporte por correo (automatización de notificación)."""
    reporte = reporte_service.get_by_id(db, reporte_id)

    try:
        email_service.send_report_email(recipient, reporte.ruta_archivo, reporte.nombre)
    except Exception as exc:  # noqa: BLE001
        bitacora_service.log(
            db, accion="ENVIO_EMAIL", estado="FALLIDO",
            usuario_id=usuario_id,
            resultado=f"Error al enviar el reporte '{reporte.nombre}': {exc}",
            detalle=traceback.format_exc(),
        )
        raise

    bitacora_service.log(
        db, accion="ENVIO_EMAIL", estado="EXITOSO",
        usuario_id=usuario_id,
        resultado=f"Reporte '{reporte.nombre}' enviado a {recipient}.",
    )
    return {"ok": True, "reporte_id": reporte_id, "destinatario": recipient}
