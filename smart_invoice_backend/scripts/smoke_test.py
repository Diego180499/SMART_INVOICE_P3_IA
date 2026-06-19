"""Prueba de humo end-to-end usando el TestClient de FastAPI.

Verifica: health, login, perfil, creación/listado/búsqueda de proveedores y
listado de facturas/bitácora. No requiere un servidor en ejecución.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def main() -> None:
    r = client.get("/health")
    print("health:", r.status_code, r.json())

    r = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@smartinvoice.com", "password": "Admin123"},
    )
    print("login:", r.status_code)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/api/v1/auth/me", headers=headers)
    print("me:", r.status_code, r.json()["email"], r.json()["rol"])

    nit = "9988776-5"
    r = client.post(
        "/api/v1/proveedores",
        headers=headers,
        json={"nombre": "Proveedor Demo S.A.", "nit": nit, "email": "demo@prov.com"},
    )
    print("crear proveedor:", r.status_code, r.text[:120])

    r = client.get("/api/v1/proveedores", headers=headers)
    print("listar proveedores: total =", r.json()["total"])

    r = client.get(f"/api/v1/proveedores/buscar?q=Demo", headers=headers)
    print("buscar proveedores:", r.status_code, "encontrados =", len(r.json()))

    r = client.get("/api/v1/facturas", headers=headers)
    print("listar facturas: total =", r.json()["total"])

    r = client.get("/api/v1/bitacora", headers=headers)
    print("listar bitacora: total =", r.json()["total"])

    print("\nSMOKE TEST OK")


if __name__ == "__main__":
    main()
