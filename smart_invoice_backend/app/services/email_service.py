"""Servicio de envío de correos electrónicos vía SMTP (stdlib)."""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

from app.config import BASE_DIR, settings
from app.core.exceptions import ValidationError


def send_report_email(to: str, reporte_path: str, reporte_nombre: str) -> bool:
    """Envía un correo con el reporte adjunto usando SMTP_SSL.

    Args:
        to: Correo del destinatario.
        reporte_path: Ruta (relativa o absoluta) al archivo del reporte.
        reporte_nombre: Nombre descriptivo del reporte (asunto/cuerpo).

    Raises:
        ValidationError: si falta configuración SMTP o el archivo no existe.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
        raise ValidationError(
            "Configuración SMTP incompleta. Define SMTP_HOST, SMTP_USER y SMTP_PASS."
        )

    path = Path(reporte_path)
    if not path.is_absolute():
        path = BASE_DIR / reporte_path
    if not path.exists():
        raise ValidationError(f"El archivo del reporte no existe: {reporte_path}")

    msg = EmailMessage()
    msg["Subject"] = f"SmartInvoice — Reporte: {reporte_nombre}"
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg.set_content(
        f"Estimado usuario,\n\n"
        f"Adjunto encontrará el reporte solicitado: {reporte_nombre}.\n\n"
        f"Este mensaje fue generado automáticamente por el sistema SmartInvoice.\n"
    )

    data = path.read_bytes()
    msg.add_attachment(
        data, maintype="application", subtype="octet-stream", filename=path.name
    )

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.send_message(msg)
    return True
