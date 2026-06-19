"""Servicio de autenticación: registro, login y gestión de perfil."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Valida credenciales. Devuelve el usuario si son correctas, si no None."""
    user = get_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_user(db: Session, data: UserCreate) -> User:
    """Registra un nuevo usuario con la contraseña hasheada."""
    if get_by_email(db, data.email):
        raise ConflictError("Ya existe un usuario con ese correo electrónico.")

    user = User(
        nombre=data.nombre,
        email=data.email,
        password_hash=hash_password(data.password),
        rol=data.rol,
        activo=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: UserUpdate) -> User:
    """Actualiza el perfil de un usuario existente."""
    user = db.get(User, user_id)
    if not user:
        raise NotFoundError("Usuario no encontrado.")

    if data.email and data.email != user.email:
        if get_by_email(db, data.email):
            raise ConflictError("Ese correo ya está en uso por otro usuario.")
        user.email = data.email
    if data.nombre:
        user.nombre = data.nombre
    if data.password:
        if len(data.password) < 6:
            raise ValidationError("La contraseña debe tener al menos 6 caracteres.")
        user.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(user)
    return user
