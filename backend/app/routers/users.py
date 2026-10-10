import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, get_current_user
from app.db import Conn, get_conn
from app.schemas import User, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=User)
def get_me(user: CurrentUser = Depends(get_current_user)):
    return user


@router.put("/me", response_model=User)
def update_me(
    body: UserUpdate,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    return conn.execute(
        "UPDATE users SET name = %s, phone = %s WHERE id = %s "
        "RETURNING id, name, email, phone",
        (body.name, body.phone, user["id"]),
    ).fetchone()


@router.delete("/me", status_code=204)
def delete_me(user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)):
    try:
        conn.execute("DELETE FROM users WHERE id = %s", (user["id"],))
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(409, "Delete or leave your groups and expenses first")
