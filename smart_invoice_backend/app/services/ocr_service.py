"""Orquestador del pipeline OCR completo.

Flujo: preprocesamiento (OpenCV) → Tesseract → extracción (regex) →
validación → persistencia. Cada etapa se registra en la bitácora y el estado
de la factura se actualiza en consecuencia.
"""
from __future__ import annotations

import logging
import traceback

from sqlalchemy.orm import Session

from app.config import settings
from app.core.exceptions import NotFoundError
from app.models.dato_extraido import DatoExtraido
from app.models.factura import Factura
from app.services import (
    bitacora_service,
    cv_service,
    extraction_service,
    proveedor_service,
    validation_service,
)

logger = logging.getLogger("smartinvoice.ocr")


def _import_pytesseract():
    try:
        import pytesseract
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "pytesseract no está instalado. Instala las dependencias OCR."
        ) from exc
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    return pytesseract


def _run_tesseract(images: list) -> tuple[str, float]:
    """Ejecuta Tesseract sobre las imágenes y devuelve (texto, confianza_promedio)."""
    pytesseract = _import_pytesseract()
    config = "--oem 3 --psm 6"

    textos: list[str] = []
    confianzas: list[float] = []

    for img in images:
        texto = pytesseract.image_to_string(img, lang=settings.OCR_LANG, config=config)
        textos.append(texto)

        data = pytesseract.image_to_data(
            img, lang=settings.OCR_LANG, config=config,
            output_type=pytesseract.Output.DICT,
        )
        for conf in data.get("conf", []):
            try:
                c = float(conf)
            except (TypeError, ValueError):
                continue
            if c >= 0:
                confianzas.append(c)

    texto_completo = "\n".join(textos).strip()
    confianza_prom = round(sum(confianzas) / len(confianzas), 2) if confianzas else 0.0
    return texto_completo, confianza_prom


def _asociar_proveedor(db: Session, nit_ocr: str | None) -> int | None:
    """Intenta asociar la factura a un proveedor del catálogo por NIT."""
    if not nit_ocr:
        return None
    proveedor = proveedor_service.get_by_nit(db, nit_ocr)
    return proveedor.id if proveedor else None


def process_invoice(db: Session, factura_id: int, usuario_id: int | None = None) -> DatoExtraido:
    """Ejecuta el pipeline OCR completo para una factura.

    Actualiza el estado de la factura (Procesado / Rechazado / Error) y crea o
    actualiza el registro en ``datos_extraidos``.
    """
    factura = db.get(Factura, factura_id)
    if not factura:
        raise NotFoundError("Factura no encontrada.")

    bitacora_service.log(
        db, accion="OCR_PROCESO", estado="PENDIENTE",
        factura_id=factura_id, usuario_id=usuario_id,
        resultado="Inicio del pipeline OCR.",
    )

    from app.config import BASE_DIR

    try:
        # 1) Preprocesamiento (OpenCV) + carga de imágenes.
        ruta_absoluta = str(BASE_DIR / factura.ruta_archivo)
        imagenes = cv_service.preprocess_file(ruta_absoluta, factura.tipo_archivo)

        # 2) OCR con Tesseract.
        texto_raw, confianza = _run_tesseract(imagenes)
        bitacora_service.log(
            db, accion="EXTRACCION_DATOS", estado="EXITOSO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado=f"Texto extraído ({len(texto_raw)} caracteres, "
                      f"confianza {confianza}%).",
            commit=False,
        )

        # 3) Extracción de campos (regex).
        campos = extraction_service.extract_fields(texto_raw)

        # 4) Validación automática.
        es_valido, observaciones = validation_service.validate_extracted_data(campos)
        bitacora_service.log(
            db, accion="VALIDACION_DATOS",
            estado="EXITOSO" if es_valido else "FALLIDO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado="Validación correcta." if es_valido
            else "; ".join(observaciones),
            commit=False,
        )

        # 5) Persistencia de datos extraídos (upsert 1:1).
        dato = factura.datos_extraidos or DatoExtraido(factura_id=factura_id)
        dato.numero_factura = campos["numero_factura"]
        dato.fecha_factura = campos["fecha_factura"]
        dato.nombre_proveedor_ocr = campos["nombre_proveedor_ocr"]
        dato.nit_ocr = campos["nit_ocr"]
        dato.subtotal = campos["subtotal"]
        dato.impuestos = campos["impuestos"]
        dato.total = campos["total"]
        dato.texto_raw = texto_raw
        dato.confianza_ocr = confianza
        dato.validado = 1 if es_valido else 0
        dato.observaciones_validacion = (
            None if es_valido else "; ".join(observaciones)
        )
        if dato.id is None:
            db.add(dato)

        # 6) Asociar proveedor por NIT (si existe en el catálogo).
        proveedor_id = _asociar_proveedor(db, campos["nit_ocr"])
        if proveedor_id:
            factura.proveedor_id = proveedor_id

        # 7) Estado final de la factura.
        factura.estado = "Procesado" if es_valido else "Rechazado"

        bitacora_service.log(
            db, accion="ALMACENAMIENTO_DATOS", estado="EXITOSO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado=f"Datos almacenados. Estado: {factura.estado}.",
            commit=False,
        )

        db.commit()
        db.refresh(dato)
        return dato

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Error en pipeline OCR para factura %s: %s", factura_id, exc)

        # Marcar la factura como Error y registrar el detalle técnico.
        factura = db.get(Factura, factura_id)
        if factura:
            factura.estado = "Error"
            db.commit()

        bitacora_service.log(
            db, accion="OCR_PROCESO", estado="FALLIDO",
            factura_id=factura_id, usuario_id=usuario_id,
            resultado=f"Error en el procesamiento OCR: {exc}",
            detalle=traceback.format_exc(),
        )
        raise


def get_estado(db: Session, factura_id: int) -> dict:
    """Devuelve el estado de procesamiento y un resumen de la factura."""
    factura = db.get(Factura, factura_id)
    if not factura:
        raise NotFoundError("Factura no encontrada.")

    dato = factura.datos_extraidos
    return {
        "factura_id": factura.id,
        "estado": factura.estado,
        "validado": bool(dato.validado) if dato else False,
        "confianza_ocr": dato.confianza_ocr if dato else None,
        "observaciones": dato.observaciones_validacion if dato else None,
    }
