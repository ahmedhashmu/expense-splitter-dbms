"""Password hashing, JWT tokens and the `get_current_user` dependency."""
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.db import Conn, get_conn

JWT_ALGORITHM = "HS256"
TOKEN_HOURS = 24

# tokenUrl lets the "Authorize" button in /docs log in through /auth/login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

CurrentUser = dict[str, Any]


def _secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET must be set (at least 32 characters)")
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expires}, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    token: str = Depends(oauth2_scheme), conn: Conn = Depends(get_conn)
) -> CurrentUser:
    user_id = decode_token(token)
    user = conn.execute(
        "SELECT id, name, email, phone FROM users WHERE id = %s", (user_id,)
    ).fetchone()
    if not user:
        raise HTTPException(401, "User no longer exists")
    # the audit trigger reads this to record who made each change
    # (true = only for this transaction, so pooled connections don't leak it)
    conn.execute("SELECT set_config('app.user_id', %s, true)", (str(user["id"]),))
    return user
