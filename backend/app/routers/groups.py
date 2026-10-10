import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.db import Conn, get_conn
from app.schemas import Balance, Group, GroupCreate, MemberAdd, User

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=Group, status_code=201)
def create_group(body: GroupCreate, conn: Conn = Depends(get_conn)):
    try:
        group = conn.execute(
            "INSERT INTO groups (name, created_by) VALUES (%s, %s) "
            "RETURNING id, name, created_by",
            (body.name, body.created_by),
        ).fetchone()
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(404, "Creator user not found")
    assert group is not None  # INSERT ... RETURNING always yields a row
    # the creator is automatically a member
    conn.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
        (group["id"], body.created_by),
    )
    return group


@router.get("", response_model=list[Group])
def list_groups(conn: Conn = Depends(get_conn)):
    return conn.execute("SELECT id, name, created_by FROM groups ORDER BY id").fetchall()


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: int, conn: Conn = Depends(get_conn)):
    cur = conn.execute("DELETE FROM groups WHERE id = %s", (group_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "Group not found")


@router.get("/{group_id}/members", response_model=list[User])
def list_members(group_id: int, conn: Conn = Depends(get_conn)):
    return conn.execute(
        "SELECT u.id, u.name, u.email, u.phone FROM group_members gm "
        "JOIN users u ON u.id = gm.user_id WHERE gm.group_id = %s ORDER BY u.id",
        (group_id,),
    ).fetchall()


@router.post("/{group_id}/members", status_code=201)
def add_member(group_id: int, body: MemberAdd, conn: Conn = Depends(get_conn)):
    try:
        conn.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
            (group_id, body.user_id),
        )
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "Already a member")
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(404, "Group or user not found")
    return {"group_id": group_id, "user_id": body.user_id}


@router.delete("/{group_id}/members/{user_id}", status_code=204)
def remove_member(group_id: int, user_id: int, conn: Conn = Depends(get_conn)):
    cur = conn.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Member not found")


@router.get("/{group_id}/balances", response_model=list[Balance])
def group_balances(group_id: int, conn: Conn = Depends(get_conn)):
    """Positive balance = others owe this user. Negative = this user owes."""
    return conn.execute(
        "SELECT b.user_id, u.name, b.balance FROM user_balances b "
        "JOIN users u ON u.id = b.user_id WHERE b.group_id = %s ORDER BY b.balance DESC",
        (group_id,),
    ).fetchall()
