"""Servicio de validación automática de los datos extraídos por OCR."""
from __future__ import annotations

import re
from datetime import date
from decimal import Decimal

_RE_NIT_VALIDO = re.compile(r"^\d{1,9}[\-]?[0-9kK]$")
_TOLERANCIA = Decimal("0.01")  # 1% de tolerancia para la coherencia de montos


def validate_extracted_data(data: dict) -> tuple[bool, list[str]]:
    """Valida coherencia de los campos extraídos.

    Returns:
        Tupla ``(es_valido, lista_de_observaciones)``. Es válido si no hay
        observaciones que impidan el almacenamiento definitivo.
    """
    errores: list[str] = []

    subtotal: Decimal | None = data.get("subtotal")
    impuestos: Decimal | None = data.get("impuestos")
    total: Decimal | None = data.get("total")
    fecha: date | None = data.get("fecha_factura")
    nit: str | None = data.get("nit_ocr")

    # 1) Montos positivos.
    for nombre, valor in (("subtotal", subtotal), ("impuestos", impuestos), ("total", total)):
        if valor is not None and valor < 0:
            errores.append(f"El campo '{nombre}' tiene un valor negativo.")

    # 2) Coherencia matemática: total ≈ subtotal + impuestos.
    if subtotal is not None and total is not None:
        impuestos_calc = impuestos or Decimal("0")
        esperado = subtotal + impuestos_calc
        if esperado > 0:
            diff = abs(total - esperado)
            margen = esperado * _TOLERANCIA
            if diff > margen and diff > Decimal("1"):
                errores.append(
                    f"Incoherencia de montos: total ({total}) ≠ subtotal "
                    f"({subtotal}) + impuestos ({impuestos_calc})."
                )

    # 3) Fecha no futura.
    if fecha is not None and fecha > date.today():
        errores.append(f"La fecha de factura ({fecha}) es futura.")

    # 4) Formato de NIT.
    if nit and not _RE_NIT_VALIDO.match(nit.replace(" ", "")):
        errores.append(f"El NIT '{nit}' no tiene un formato válido.")

    # 5) Al menos debe existir un total identificable.
    if total is None:
        errores.append("No se pudo identificar el monto total de la factura.")

    return (len(errores) == 0, errores)
