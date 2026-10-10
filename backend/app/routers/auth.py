import psycopg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.auth import create_token, hash_password, verify_password
from app.db import Conn, get_conn
from app.schemas import RegisterBody, Token, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=User, status_code=201)
def register(body: RegisterBody, conn: Conn = Depends(get_conn)):
    try:
        return conn.execute(
            "INSERT INTO users (name, email, password_hash, phone) VALUES (%s, %s, %s, %s) "
            "RETURNING id, name, email, phone",
            (body.name, body.email.lower(), hash_password(body.password), body.phone),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "Email already registered")


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), conn: Conn = Depends(get_conn)):
    """The form field `username` holds the email."""
    user = conn.execute(
        "SELECT id, password_hash FROM users WHERE email = %s", (form.username.lower(),)
    ).fetchone()
    # same message for unknown email and wrong password
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return Token(access_token=create_token(user["id"]))
