"""Validación y almacenamiento en disco de archivos de facturas."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import settings
from app.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
EXTENSION_TO_TIPO = {
    "pdf": "PDF",
    "jpg": "JPG",
    "jpeg": "JPEG",
    "png": "PNG",
}


def _get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def validate_extension(filename: str) -> str:
    """Valida la extensión y devuelve el tipo de archivo normalizado (enum)."""
    ext = _get_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"Extensión '.{ext}' no permitida. "
            f"Formatos aceptados: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )
    return EXTENSION_TO_TIPO[ext]


def save_upload_file(file: UploadFile) -> tuple[str, str, str]:
    """Guarda el archivo subido en ``UPLOAD_DIR`` con un nombre UUID.

    Returns:
        Tupla ``(nombre_almacenado, ruta_relativa, tipo_archivo)``.

    Raises:
        ValidationError: si la extensión no es válida o el archivo excede el tamaño.
    """
    if not file.filename:
        raise ValidationError("El archivo no tiene nombre.")

    tipo_archivo = validate_extension(file.filename)
    ext = _get_extension(file.filename)

    contents = file.file.read()
    if len(contents) == 0:
        raise ValidationError("El archivo está vacío.")
    if len(contents) > settings.max_file_size_bytes:
        raise ValidationError(
            f"El archivo excede el tamaño máximo de {settings.MAX_FILE_SIZE_MB} MB."
        )

    nombre_almacenado = f"{uuid.uuid4().hex}.{ext}"
    destino: Path = settings.upload_path / nombre_almacenado
    destino.write_bytes(contents)

    # Ruta relativa respecto a la raíz del proyecto (portable entre entornos).
    ruta_relativa = f"{settings.UPLOAD_DIR}/{nombre_almacenado}"
    return nombre_almacenado, ruta_relativa, tipo_archivo


def delete_file(ruta_relativa: str) -> bool:
    """Elimina un archivo del disco. Devuelve True si se eliminó."""
    from app.config import BASE_DIR

    path = BASE_DIR / ruta_relativa
    if path.exists() and path.is_file():
        path.unlink()
        return True
    return False
