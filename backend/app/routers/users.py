import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.db import Conn, get_conn
from app.schemas import User, UserCreate

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=User, status_code=201)
def create_user(body: UserCreate, conn: Conn = Depends(get_conn)):
    try:
        return conn.execute(
            "INSERT INTO users (name, email, phone) VALUES (%s, %s, %s) "
            "RETURNING id, name, email, phone",
            (body.name, body.email, body.phone),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "Email already registered")


@router.get("", response_model=list[User])
def list_users(conn: Conn = Depends(get_conn)):
    return conn.execute("SELECT id, name, email, phone FROM users ORDER BY id").fetchall()


@router.get("/{user_id}", response_model=User)
def get_user(user_id: int, conn: Conn = Depends(get_conn)):
    row = conn.execute(
        "SELECT id, name, email, phone FROM users WHERE id = %s", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return row


@router.put("/{user_id}", response_model=User)
def update_user(user_id: int, body: UserCreate, conn: Conn = Depends(get_conn)):
    row = conn.execute(
        "UPDATE users SET name = %s, email = %s, phone = %s WHERE id = %s "
        "RETURNING id, name, email, phone",
        (body.name, body.email, body.phone, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return row


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, conn: Conn = Depends(get_conn)):
    try:
        cur = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(409, "User still has groups or expenses")
    if cur.rowcount == 0:
        raise HTTPException(404, "User not found")
