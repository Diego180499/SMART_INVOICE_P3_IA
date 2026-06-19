"""Primitivas de seguridad: hashing de contraseñas y tokens JWT.

Se utiliza ``passlib`` con bcrypt para el hashing y ``python-jose`` para
firmar/verificar los JSON Web Tokens.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica que la contraseña en texto plano coincida con el hash."""
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def create_access_token(
    data: dict, expires_delta: timedelta | None = None
) -> str:
    """Crea un JWT firmado con HS256.

    Args:
        data: Claims a incluir (típicamente ``{"sub": user_id, "rol": rol}``).
        expires_delta: Tiempo de expiración; por defecto usa la configuración.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Decodifica y valida un JWT. Devuelve el payload o ``None`` si es inválido."""
    try:
        return jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except JWTError:
        return None
