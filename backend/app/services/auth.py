import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models.user import User
from app.services.redis import get_redis

REFRESH_TOKEN_BLACKLIST_PREFIX = "token_blacklist:"


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create_user(
        self, email: str, password: str, full_name: str | None = None
    ) -> User:
        existing = await self.get_user_by_email(email)
        if existing:
            raise ConflictError("User with this email already exists")

        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role="user",
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def authenticate(self, email: str, password: str) -> User | None:
        user = await self.get_user_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return user

    def create_tokens(self, user: User) -> dict:
        access_token = create_access_token(subject=str(user.id), role=user.role)
        refresh_token = create_refresh_token(subject=str(user.id))
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def refresh_access_token(self, refresh_token: str) -> dict:
        if await self._is_token_blacklisted(refresh_token):
            raise AuthenticationError("Token has been revoked")

        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        user_id = uuid.UUID(payload["sub"])
        user = await self.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        return self.create_tokens(user)

    async def logout(self, refresh_token: str) -> None:
        """Blacklist a refresh token so it can no longer be used."""
        try:
            payload = decode_token(refresh_token)
            ttl = int(payload["exp"] - payload["iat"])
        except Exception:
            ttl = 7 * 24 * 3600  # fallback: 7 days

        redis_client = await get_redis()
        await redis_client.set(
            f"{REFRESH_TOKEN_BLACKLIST_PREFIX}{refresh_token}",
            "1",
            ex=ttl,
        )

    async def _is_token_blacklisted(self, token: str) -> bool:
        redis_client = await get_redis()
        return await redis_client.exists(f"{REFRESH_TOKEN_BLACKLIST_PREFIX}{token}") > 0
