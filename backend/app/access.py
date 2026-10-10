"""Authorization helpers: who may see or change what."""
from typing import Any

from fastapi import HTTPException

from app.db import Conn


def require_member(conn: Conn, group_id: int, user_id: int) -> None:
    """404 (not 403) so we don't reveal that someone else's group exists."""
    row = conn.execute(
        "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Group not found")


def require_creator(conn: Conn, group_id: int, user_id: int) -> None:
    require_member(conn, group_id, user_id)
    row = conn.execute("SELECT created_by FROM groups WHERE id = %s", (group_id,)).fetchone()
    if not row or row["created_by"] != user_id:
        raise HTTPException(403, "Only the group creator can do this")


def get_expense_for_member(conn: Conn, expense_id: int, user_id: int) -> dict[str, Any]:
    """Load an expense (plus the group creator) only if the user is in its group."""
    row = conn.execute(
        "SELECT e.*, g.created_by AS group_creator FROM expenses e "
        "JOIN groups g ON g.id = e.group_id "
        "JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = %s "
        "WHERE e.id = %s",
        (user_id, expense_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Expense not found")
    return row


def require_can_edit_expense(expense: dict[str, Any], user_id: int) -> None:
    if user_id not in (expense["paid_by"], expense["group_creator"]):
        raise HTTPException(403, "Only the payer or the group creator can change this expense")
