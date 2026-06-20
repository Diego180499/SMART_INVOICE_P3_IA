"""Servicio de extracción de campos estructurados a partir del texto OCR.

Utiliza expresiones regulares y heurísticas adaptadas a facturas (formato
guatemalteco: NIT, montos en quetzales, fechas). La extracción de montos es
**por línea**: localiza la línea de la etiqueta (Subtotal, IVA, Total) y toma
el monto de esa misma línea, tolerando el símbolo de moneda y los espacios
("Q 6 087.34"), ignorando porcentajes ("IVA 12%") y evitando que la búsqueda
cruce saltos de línea hacia la tabla de detalle.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

# ── Número de factura ──────────────────────────────────────────
_RE_NUMERO_FACTURA = re.compile(
    r"(?:factura|serie|no\.?|n[uú]mero|nro\.?|invoice)\s*[:#]?\s*"
    r"([A-Z0-9][A-Z0-9\-/]{2,})",
    re.IGNORECASE,
)

# ── Fechas ─────────────────────────────────────────────────────
_RE_FECHA = re.compile(
    r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})"
)
_RE_FECHA_LABEL = re.compile(
    r"(?:fecha|date|emisi[oó]n)\s*[:#]?\s*"
    r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})",
    re.IGNORECASE,
)

# ── NIT (formato guatemalteco) ─────────────────────────────────
_RE_NIT = re.compile(
    r"(?:nit|n\.i\.t\.?)\s*[:#]?\s*([0-9]{1,9}[\-\s]?[0-9kK])",
    re.IGNORECASE,
)
_RE_NIT_LOOSE = re.compile(r"\b(\d{4,9}[\-]\d?[0-9kK])\b")

# ── Proveedor ──────────────────────────────────────────────────
_RE_PROVEEDOR_LABEL = re.compile(r"\bproveedor\b\s*[:#]?\s*(.+)", re.IGNORECASE)

# ── Etiquetas de montos (a nivel de línea) ─────────────────────
_RE_LBL_SUBTOTAL = re.compile(r"\bsub\s*-?\s*total\b", re.IGNORECASE)
_RE_LBL_IMPUESTOS = re.compile(r"\b(?:iva|i\.v\.a\.?|impuesto[s]?|tax)\b", re.IGNORECASE)
# \btotal\b NO coincide dentro de 'Subtotal' (sin frontera de palabra entre b y t).
_RE_LBL_TOTAL = re.compile(r"\btotal\b", re.IGNORECASE)

# Un número monetario (con separadores de miles/decimales opcionales).
_RE_MONEY = re.compile(r"\d[\d.,]*\d|\d")
# Porcentaje a ignorar (ej. 'IVA 12%').
_RE_PCT = re.compile(r"\d+(?:[.,]\d+)?\s*%")

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
    cleaned = re.sub(r"[^\d.,]", "", str(text)).strip()
    if not cleaned:
        return None

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


def _amounts_in_line(line: str) -> list[Decimal]:
    """Devuelve los montos de una línea, ignorando porcentajes (ej. '12%')."""
    sin_pct = _RE_PCT.sub(" ", line)
    valores = [parse_amount(tok) for tok in _RE_MONEY.findall(sin_pct)]
    return [v for v in valores if v is not None]


def _amount_for_label(
    text: str,
    label_re: re.Pattern,
    exclude_re: re.Pattern | None = None,
) -> Decimal | None:
    """Busca el monto asociado a una etiqueta dentro de SU MISMA línea.

    - Solo considera líneas que contienen la etiqueta.
    - Ignora líneas que coincidan con ``exclude_re`` (ej. excluir 'Subtotal'
      al buscar 'Total').
    - Toma el ÚLTIMO número de la línea (el monto suele ir a la derecha).
    - Si la etiqueta aparece en varias líneas, conserva la última (los totales
      suelen estar al final del documento).
    """
    encontrado: Decimal | None = None
    for line in text.splitlines():
        if not label_re.search(line):
            continue
        if exclude_re is not None and exclude_re.search(line):
            continue
        montos = _amounts_in_line(line)
        if montos:
            encontrado = montos[-1]
    return encontrado


def _extract_proveedor(text: str) -> str | None:
    """Extrae el nombre del proveedor.

    1) Prioriza la línea etiquetada ``Proveedor: <nombre>``.
    2) Como respaldo, toma la primera línea con aspecto de nombre, usando
       límites de palabra para no confundir 'Manufacturas' con 'factura'.
    """
    for line in text.splitlines():
        match = _RE_PROVEEDOR_LABEL.search(line)
        if match:
            nombre = match.group(1).strip(" :#-\t")
            if len(nombre) >= 2:
                return nombre[:255]

    skip = (
        "factura", "nit", "fecha", "serie", "cliente", "total", "subtotal",
        "iva", "impuesto", "descripcion", "descripción", "cantidad", "precio",
        "direccion", "dirección", "telefono", "teléfono", "correo", "email",
        "documento",
    )
    for line in text.splitlines():
        clean = line.strip()
        letters = sum(c.isalpha() for c in clean)
        if len(clean) >= 5 and letters >= 4 and not _RE_FECHA.search(clean):
            lowered = clean.lower()
            if not any(re.search(r"\b" + re.escape(k) + r"\b", lowered) for k in skip):
                return clean[:255]
    return None


def _extract_fecha(text: str) -> date | None:
    """Prefiere la fecha etiquetada ('Fecha: ...'); si no, la primera del texto."""
    match = _RE_FECHA_LABEL.search(text)
    if match:
        parsed = parse_date(match.group(1))
        if parsed:
            return parsed
    match = _RE_FECHA.search(text)
    return parse_date(match.group(1)) if match else None


def extract_fields(raw_text: str) -> dict:
    """Aplica todos los extractores y devuelve un diccionario de campos.

    Claves: numero_factura, fecha_factura, nombre_proveedor_ocr, nit_ocr,
    subtotal, impuestos, total.
    """
    text = raw_text or ""

    numero_match = _RE_NUMERO_FACTURA.search(text)
    numero_factura = numero_match.group(1).strip() if numero_match else None

    subtotal = _amount_for_label(text, _RE_LBL_SUBTOTAL)
    impuestos = _amount_for_label(text, _RE_LBL_IMPUESTOS)
    total = _amount_for_label(text, _RE_LBL_TOTAL, exclude_re=_RE_LBL_SUBTOTAL)

    # Inferencias cuando falta uno de los tres montos.
    if total is None and subtotal is not None:
        total = subtotal + (impuestos or Decimal("0"))
    elif subtotal is None and total is not None and impuestos is not None:
        subtotal = total - impuestos

    return {
        "numero_factura": numero_factura,
        "fecha_factura": _extract_fecha(text),
        "nombre_proveedor_ocr": _extract_proveedor(text),
        "nit_ocr": extract_nit(text),
        "subtotal": subtotal,
        "impuestos": impuestos,
        "total": total,
    }
