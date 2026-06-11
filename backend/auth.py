from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt

from jose import JWTError, jwt

from fastapi import Depends, HTTPException, status

from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User

import os


# ==========================================
# JWT CONFIG
# ==========================================

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "CHANGE_THIS_SECRET_IN_PRODUCTION_5A7D92E8B1"
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60"
    )
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/login"
)


# ==========================================
# PASSWORDS
# ==========================================

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)

    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        salt
    )

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


# ==========================================
# JWT
# ==========================================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        }
    )

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )


# ==========================================
# USERS
# ==========================================

async def get_user_by_username(
    username: str,
    db: AsyncSession
) -> Optional[User]:

    result = await db.execute(
        select(User).where(
            User.username == username
        )
    )

    return result.scalars().first()


# ==========================================
# AUTH
# ==========================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить токен",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    try:
        payload = decode_token(token)

        username: str | None = payload.get("sub")

        token_type = payload.get("type")

        if not username:
            raise credentials_exception

        if token_type != "access":
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = await get_user_by_username(
        username,
        db
    )

    if not user:
        raise credentials_exception

    return user


# ==========================================
# ROLES
# ==========================================

async def get_admin_or_developer(
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role not in (
        "admin",
        "developer"
    ):
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав"
        )

    return current_user


async def get_developer_only(
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role != "developer":
        raise HTTPException(
            status_code=403,
            detail="Только разработчик может выполнять это действие"
        )

    return current_user


# ==========================================
# OPTIONAL HELPERS
# ==========================================

async def get_optional_user(
    db: AsyncSession,
    token: Optional[str] = Depends(
        oauth2_scheme
    )
):

    try:
        payload = decode_token(token)

        username = payload.get("sub")

        if not username:
            return None

        return await get_user_by_username(
            username,
            db
        )

    except Exception:
        return None