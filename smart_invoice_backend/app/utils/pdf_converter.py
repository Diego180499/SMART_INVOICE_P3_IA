"""Conversión de archivos PDF a imágenes para el pipeline OCR.

Usa ``pdf2image`` (que a su vez requiere Poppler). Las importaciones son
perezosas para que el resto de la API funcione aunque Poppler/pdf2image no
estén instalados en el entorno local.
"""
from __future__ import annotations

from app.config import settings


def pdf_to_images(pdf_path: str, dpi: int = 300) -> list:
    """Convierte cada página de un PDF a un arreglo NumPy (BGR para OpenCV).

    Returns:
        Lista de imágenes ``numpy.ndarray``.

    Raises:
        RuntimeError: si faltan dependencias (pdf2image / Poppler).
    """
    try:
        import numpy as np
        from pdf2image import convert_from_path
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "pdf2image/numpy no están instalados. Instala las dependencias OCR."
        ) from exc

    kwargs: dict = {"dpi": dpi}
    if settings.POPPLER_PATH:
        kwargs["poppler_path"] = settings.POPPLER_PATH

    try:
        pil_images = convert_from_path(pdf_path, **kwargs)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "No se pudo convertir el PDF. Verifica que Poppler esté instalado "
            "y configurado en POPPLER_PATH."
        ) from exc

    # PIL (RGB) -> NumPy (RGB) -> BGR para compatibilidad con OpenCV.
    return [np.array(img)[:, :, ::-1].copy() for img in pil_images]
