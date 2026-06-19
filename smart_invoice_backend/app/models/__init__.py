"""Modelos ORM de SmartInvoice.

Se importan todos los modelos aquí para que SQLAlchemy registre el metadata
completo (necesario para resolver relaciones por nombre y para Alembic).
"""
from app.models.bitacora import Bitacora
from app.models.dato_extraido import DatoExtraido
from app.models.factura import Factura
from app.models.proveedor import Proveedor
from app.models.reporte import Reporte
from app.models.user import User

__all__ = [
    "User",
    "Proveedor",
    "Factura",
    "DatoExtraido",
    "Bitacora",
    "Reporte",
]
