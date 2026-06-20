"""Script utilitario para crear (o reiniciar) un usuario administrador.

Uso:
    python -m scripts.create_admin --email admin@smartinvoice.com --password Admin123 --nombre "Administrador"

Si el correo ya existe, actualiza su contraseña y rol a admin.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth_service import get_by_email  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Crear/actualizar usuario admin")
    parser.add_argument("--email", default="admin@smartinvoice.com")
    parser.add_argument("--password", default="Admin123")
    parser.add_argument("--nombre", default="Administrador")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = get_by_email(db, args.email)
        if user:
            user.password_hash = hash_password(args.password)
            user.rol = "admin"
            user.activo = 1
            accion = "actualizado"
        else:
            user = User(
                nombre=args.nombre,
                email=args.email,
                password_hash=hash_password(args.password),
                rol="admin",
                activo=1,
            )
            db.add(user)
            accion = "creado"
        db.commit()
        db.refresh(user)
        print(f"Usuario admin {accion}: {user.email} (id={user.id})")
        print(f"Contraseña: {args.password}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
