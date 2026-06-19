"""Servicio de extracción de campos estructurados a partir del texto OCR.

Utiliza expresiones regulares y heurísticas adaptadas a facturas
(especialmente al formato guatemalteco: NIT, montos en quetzales, fechas).
"""
from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

# ── Patrones de número de factura ──────────────────────────────
_RE_NUMERO_FACTURA = re.compile(
    r"(?:factura|serie|no\.?|n[uú]mero|nro\.?|invoice)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{2,})",
    re.IGNORECASE,
)

# ── Fechas en múltiples formatos ───────────────────────────────
_RE_FECHA = re.compile(
    r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})"
)

# ── NIT (formato guatemalteco: dígitos + guion + dígito/K) ─────
_RE_NIT = re.compile(
    r"(?:nit|n\.i\.t\.?)\s*[:#]?\s*([0-9]{1,9}[\-\s]?[0-9kK])",
    re.IGNORECASE,
)
_RE_NIT_LOOSE = re.compile(r"\b(\d{4,9}[\-]\d?[0-9kK])\b")

# ── Montos monetarios ──────────────────────────────────────────
_RE_SUBTOTAL = re.compile(
    r"(?:sub\s*[\-]?\s*total)\s*[:Qq$]*\s*([\d.,]+)", re.IGNORECASE
)
_RE_IMPUESTOS = re.compile(
    r"(?:iva|impuesto[s]?|tax|i\.v\.a\.?)\s*[:Qq$%\d]*\s*([\d.,]+)", re.IGNORECASE
)
_RE_TOTAL = re.compile(
    r"(?:total\s*(?:a\s*pagar|general|factura)?)\s*[:Qq$]*\s*([\d.,]+)",
    re.IGNORECASE,
)

_FECHA_FORMATS = (
    "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
    "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
    "%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d",
)


def parse_amount(text: str | None) -> Decimal | None:
    """Convierte una cadena monetaria a Decimal manejando separadores.

    Soporta formatos como ``1,234.56`` y ``1.234,56``.
    """
    if not text:
        return None
    cleaned = re.sub(r"[^\d.,]", "", text).strip()
    if not cleaned:
        return None

    # Determinar el separador decimal: el último de coma/punto.
    last_comma = cleaned.rfind(",")
    last_dot = cleaned.rfind(".")

    if last_comma > last_dot:
        # Coma decimal (1.234,56) -> quitar puntos, coma a punto.
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        # Punto decimal (1,234.56) -> quitar comas.
        cleaned = cleaned.replace(",", "")

    try:
        value = Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None
    return value if value >= 0 else None


def parse_date(text: str | None) -> date | None:
    """Parsea una fecha en múltiples formatos comunes."""
    if not text:
        return None
    candidate = text.strip().replace(".", "/").replace("-", "/")
    for fmt in _FECHA_FORMATS:
        try:
            return datetime.strptime(candidate, fmt.replace("-", "/").replace(".", "/")).date()
        except ValueError:
            continue
    return None


def extract_nit(text: str) -> str | None:
    """Extrae el NIT con patrón etiquetado y, en su defecto, uno suelto."""
    match = _RE_NIT.search(text)
    if match:
        return re.sub(r"\s", "", match.group(1)).upper()
    match = _RE_NIT_LOOSE.search(text)
    if match:
        return match.group(1).upper()
    return None


def _first_amount(pattern: re.Pattern, text: str) -> Decimal | None:
    match = pattern.search(text)
    return parse_amount(match.group(1)) if match else None


def _extract_proveedor(text: str) -> str | None:
    """Heurística: el nombre del proveedor suele estar en las primeras líneas."""
    for line in text.splitlines():
        clean = line.strip()
        # Línea con suficientes letras, sin parecer una etiqueta de campo.
        letters = sum(c.isalpha() for c in clean)
        if len(clean) >= 5 and letters >= 4 and not _RE_FECHA.search(clean):
            lowered = clean.lower()
            if not any(k in lowered for k in ("factura", "nit", "fecha", "serie")):
                return clean[:255]
    return None


def extract_fields(raw_text: str) -> dict:
    """Aplica todos los extractores y devuelve un diccionario de campos.

    Claves: numero_factura, fecha_factura, nombre_proveedor_ocr, nit_ocr,
    subtotal, impuestos, total.
    """
    text = raw_text or ""

    numero_match = _RE_NUMERO_FACTURA.search(text)
    numero_factura = numero_match.group(1).strip() if numero_match else None

    fecha_match = _RE_FECHA.search(text)
    fecha_factura = parse_date(fecha_match.group(1)) if fecha_match else None

    subtotal = _first_amount(_RE_SUBTOTAL, text)
    impuestos = _first_amount(_RE_IMPUESTOS, text)
    total = _first_amount(_RE_TOTAL, text)

    # Si no se halló total explícito pero hay subtotal+impuestos, inferirlo.
    if total is None and subtotal is not None:
        total = subtotal + (impuestos or Decimal("0"))

    return {
        "numero_factura": numero_factura,
        "fecha_factura": fecha_factura,
        "nombre_proveedor_ocr": _extract_proveedor(text),
        "nit_ocr": extract_nit(text),
        "subtotal": subtotal,
        "impuestos": impuestos,
        "total": total,
    }
