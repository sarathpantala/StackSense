from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession
from app.api.v1.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.core.exceptions import AppException
from app.db.models.user import User
from app.db.session import get_db
from app.services.auth import AuthService
from app.services.rate_limiter import check_auth_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: DBSession, request: Request):
    await check_auth_rate_limit(request)
    auth_service = AuthService(db)
    try:
        user = await auth_service.create_user(
            email=body.email, password=body.password, full_name=body.full_name
        )
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e

    return auth_service.create_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DBSession, request: Request):
    await check_auth_rate_limit(request)
    auth_service = AuthService(db)
    user = await auth_service.authenticate(email=body.email, password=body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return auth_service.create_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: DBSession):
    auth_service = AuthService(db)
    try:
        tokens = await auth_service.refresh_access_token(body.refresh_token)
    except (AppException, jwt.InvalidTokenError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from e
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutRequest, db: DBSession, _user: CurrentUser):
    auth_service = AuthService(db)
    await auth_service.logout(body.refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )
