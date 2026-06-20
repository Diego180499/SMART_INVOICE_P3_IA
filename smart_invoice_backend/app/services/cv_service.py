"""Servicio de Computer Vision: preprocesamiento de imágenes con OpenCV.

Todas las importaciones de OpenCV/NumPy son perezosas para que la API
arranque aunque estas librerías pesadas no estén instaladas localmente.
El pipeline de preprocesamiento mejora la precisión del OCR.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.utils.pdf_converter import pdf_to_images

if TYPE_CHECKING:  # pragma: no cover
    import numpy as np


def _import_cv():
    try:
        import cv2
        import numpy as np
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "OpenCV/NumPy no están instalados. Instala las dependencias OCR."
        ) from exc
    return cv2, np


def to_grayscale(image: "np.ndarray") -> "np.ndarray":
    cv2, np = _import_cv()
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def resize_if_small(image: "np.ndarray", min_width: int = 1000) -> "np.ndarray":
    """Duplica la resolución si la imagen es pequeña (mejora el OCR)."""
    cv2, _ = _import_cv()
    h, w = image.shape[:2]
    if w < min_width:
        return cv2.resize(image, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    return image


def remove_noise(image: "np.ndarray") -> "np.ndarray":
    """Filtro de mediana para eliminar ruido tipo sal y pimienta."""
    cv2, _ = _import_cv()
    return cv2.medianBlur(image, 3)


def binarize(image: "np.ndarray") -> "np.ndarray":
    """Umbralización Otsu para obtener una imagen binaria limpia."""
    cv2, _ = _import_cv()
    _, thresh = cv2.threshold(
        image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    return thresh


def deskew(image: "np.ndarray") -> "np.ndarray":
    """Corrige la inclinación del texto usando el ángulo del área mínima."""
    cv2, np = _import_cv()
    inv = cv2.bitwise_not(image)
    coords = np.column_stack(np.where(inv > 0))
    if coords.size == 0:
        return image

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # Evita rotaciones excesivas por ruido.
    if abs(angle) < 0.5 or abs(angle) > 45:
        return image

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        image, m, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess_image(image: "np.ndarray") -> "np.ndarray":
    """Pipeline completo de preprocesamiento OpenCV sobre una imagen en memoria."""
    gray = to_grayscale(image)
    gray = resize_if_small(gray)
    gray = remove_noise(gray)
    binary = binarize(gray)
    return deskew(binary)


def load_images(file_path: str, tipo_archivo: str) -> list["np.ndarray"]:
    """Carga el archivo como lista de imágenes (1 por página en PDF)."""
    cv2, _ = _import_cv()
    if tipo_archivo.upper() == "PDF":
        return pdf_to_images(file_path)

    image = cv2.imread(file_path)
    if image is None:
        raise RuntimeError(f"No se pudo leer la imagen: {file_path}")
    return [image]


def preprocess_file(file_path: str, tipo_archivo: str) -> list["np.ndarray"]:
    """Carga y preprocesa todas las páginas/imágenes de un archivo."""
    return [preprocess_image(img) for img in load_images(file_path, tipo_archivo)]
