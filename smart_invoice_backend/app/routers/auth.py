"""Router de autenticación: /api/v1/auth."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.dependencies import CurrentUser, DbSession
from app.core.security import create_access_token
from app.schemas.user import Token, UserCreate, UserRead, UserUpdate
from app.services import auth_service, bitacora_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
):
    """Inicia sesión con email (username) y contraseña; devuelve un JWT.

    Compatible con el flujo OAuth2 de Swagger: el campo *username* es el email.
    """
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        bitacora_service.log(
            db, accion="LOGIN", estado="FALLIDO",
            resultado=f"Intento de login fallido para '{form_data.username}'.",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": str(user.id), "rol": user.rol})
    bitacora_service.log(
        db, accion="LOGIN", estado="EXITOSO",
        usuario_id=user.id, resultado=f"Inicio de sesión de '{user.email}'.",
    )
    return Token(access_token=token, user=UserRead.model_validate(user))


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: DbSession):
    """Registra un nuevo usuario en el sistema."""
    return auth_service.create_user(db, data)


@router.get("/me", response_model=UserRead)
def get_me(current_user: CurrentUser):
    """Devuelve el perfil del usuario autenticado."""
    return current_user


@router.put("/me", response_model=UserRead)
def update_me(data: UserUpdate, current_user: CurrentUser, db: DbSession):
    """Actualiza el perfil del usuario autenticado."""
    return auth_service.update_user(db, current_user.id, data)
