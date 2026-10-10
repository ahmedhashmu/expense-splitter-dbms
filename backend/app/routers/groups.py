import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.access import require_creator, require_member
from app.auth import CurrentUser, get_current_user
from app.db import Conn, get_conn
from app.schemas import Balance, Group, GroupCreate, MemberAdd, User

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=Group, status_code=201)
def create_group(
    body: GroupCreate,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    group = conn.execute(
        "INSERT INTO groups (name, created_by) VALUES (%s, %s) RETURNING id, name, created_by",
        (body.name, user["id"]),
    ).fetchone()
    assert group is not None  # INSERT ... RETURNING always yields a row
    # the creator is automatically a member
    conn.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
        (group["id"], user["id"]),
    )
    return group


@router.get("", response_model=list[Group])
def list_my_groups(user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)):
    return conn.execute(
        "SELECT g.id, g.name, g.created_by FROM groups g "
        "JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = %s ORDER BY g.id",
        (user["id"],),
    ).fetchall()


@router.put("/{group_id}", response_model=Group)
def rename_group(
    group_id: int,
    body: GroupCreate,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    require_creator(conn, group_id, user["id"])
    return conn.execute(
        "UPDATE groups SET name = %s WHERE id = %s RETURNING id, name, created_by",
        (body.name, group_id),
    ).fetchone()


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    require_creator(conn, group_id, user["id"])
    conn.execute("DELETE FROM groups WHERE id = %s", (group_id,))


@router.get("/{group_id}/members", response_model=list[User])
def list_members(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    require_member(conn, group_id, user["id"])
    return conn.execute(
        "SELECT u.id, u.name, u.email, u.phone FROM group_members gm "
        "JOIN users u ON u.id = gm.user_id WHERE gm.group_id = %s ORDER BY u.id",
        (group_id,),
    ).fetchall()


@router.post("/{group_id}/members", response_model=User, status_code=201)
def add_member(
    group_id: int,
    body: MemberAdd,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    """Add someone by their registered email."""
    require_member(conn, group_id, user["id"])
    new = conn.execute(
        "SELECT id, name, email, phone FROM users WHERE email = %s", (body.email.lower(),)
    ).fetchone()
    if not new:
        raise HTTPException(404, "No user with that email")
    try:
        conn.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
            (group_id, new["id"]),
        )
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "Already a member")
    return new


@router.delete("/{group_id}/members/{member_id}", status_code=204)
def remove_member(
    group_id: int,
    member_id: int,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    """You can leave yourself; the creator can remove anyone."""
    if member_id == user["id"]:
        require_member(conn, group_id, user["id"])
    else:
        require_creator(conn, group_id, user["id"])
    # removing someone with money history would break the balances
    used = conn.execute(
        "SELECT 1 FROM expenses e WHERE e.group_id = %(g)s AND e.paid_by = %(u)s "
        "UNION ALL SELECT 1 FROM expense_splits s JOIN expenses e ON e.id = s.expense_id "
        "WHERE e.group_id = %(g)s AND s.user_id = %(u)s "
        "UNION ALL SELECT 1 FROM settlements st WHERE st.group_id = %(g)s "
        "AND %(u)s IN (st.from_user, st.to_user) LIMIT 1",
        {"g": group_id, "u": member_id},
    ).fetchone()
    if used:
        raise HTTPException(409, "Member has expenses or settlements in this group")
    cur = conn.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, member_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Member not found")


@router.get("/{group_id}/balances", response_model=list[Balance])
def group_balances(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    """Positive balance = others owe this user. Negative = this user owes."""
    require_member(conn, group_id, user["id"])
    return conn.execute(
        "SELECT b.user_id, u.name, b.balance FROM user_balances b "
        "JOIN users u ON u.id = b.user_id WHERE b.group_id = %s ORDER BY b.balance DESC",
        (group_id,),
    ).fetchall()
