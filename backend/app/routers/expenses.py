from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from app.access import (
    get_expense_for_member,
    require_can_edit_expense,
    require_member,
)
from app.auth import CurrentUser, get_current_user
from app.db import Conn, get_conn
from app.schemas import ExpenseCreate, ExpenseUpdate, SettlementCreate
from app.splits import SplitError, equal_split, exact_split, percentage_split

router = APIRouter(tags=["expenses"])


def _compute_shares(body: ExpenseCreate) -> dict[int, Decimal]:
    ids = [p.user_id for p in body.participants]
    if len(set(ids)) != len(ids):
        raise SplitError("A participant is listed twice")
    if body.split_type == "equal":
        return equal_split(body.amount, ids)
    if any(p.value is None for p in body.participants):
        raise SplitError("Every participant needs a value for this split type")
    values = {p.user_id: p.value for p in body.participants if p.value is not None}
    if body.split_type == "exact":
        return exact_split(body.amount, values)
    return percentage_split(body.amount, values)


def _group_member_ids(conn: Conn, group_id: int) -> set[int]:
    rows = conn.execute(
        "SELECT user_id FROM group_members WHERE group_id = %s", (group_id,)
    ).fetchall()
    return {r["user_id"] for r in rows}


@router.post("/groups/{group_id}/expenses", status_code=201)
def create_expense(
    group_id: int,
    body: ExpenseCreate,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    require_member(conn, group_id, user["id"])
    members = _group_member_ids(conn, group_id)
    involved = {body.paid_by, *(p.user_id for p in body.participants)}
    if not involved <= members:
        raise HTTPException(400, "Payer and participants must all be group members")
    try:
        shares = _compute_shares(body)
    except SplitError as e:
        raise HTTPException(400, str(e))

    # both inserts run in one transaction (committed when the request ends)
    expense = conn.execute(
        "INSERT INTO expenses (group_id, paid_by, amount, description, split_type, expense_date) "
        "VALUES (%s, %s, %s, %s, %s, COALESCE(%s, CURRENT_DATE)) "
        "RETURNING id, group_id, paid_by, amount, description, split_type, expense_date",
        (group_id, body.paid_by, body.amount, body.description, body.split_type, body.expense_date),
    ).fetchone()
    assert expense is not None  # INSERT ... RETURNING always yields a row
    for user_id, share in shares.items():
        conn.execute(
            "INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES (%s, %s, %s)",
            (expense["id"], user_id, share),
        )
    return {**expense, "splits": [{"user_id": u, "share_amount": s} for u, s in shares.items()]}


@router.get("/groups/{group_id}/expenses")
def list_expenses(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    require_member(conn, group_id, user["id"])
    return conn.execute(
        "SELECT e.id, e.paid_by, u.name AS paid_by_name, e.amount, e.description, "
        "e.split_type, e.expense_date FROM expenses e JOIN users u ON u.id = e.paid_by "
        "WHERE e.group_id = %s ORDER BY e.expense_date DESC, e.id DESC",
        (group_id,),
    ).fetchall()


@router.get("/expenses/{expense_id}")
def get_expense(
    expense_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    expense = get_expense_for_member(conn, expense_id, user["id"])
    splits = conn.execute(
        "SELECT user_id, share_amount FROM expense_splits WHERE expense_id = %s", (expense_id,)
    ).fetchall()
    return {**expense, "splits": splits}


@router.patch("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    body: ExpenseUpdate,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    """Only description/date can change; amount changes would need splits recomputed."""
    require_can_edit_expense(get_expense_for_member(conn, expense_id, user["id"]), user["id"])
    row = conn.execute(
        "UPDATE expenses SET description = COALESCE(%s, description), "
        "expense_date = COALESCE(%s, expense_date) WHERE id = %s "
        "RETURNING id, description, expense_date",
        (body.description, body.expense_date, expense_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Expense not found")
    return row


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    require_can_edit_expense(get_expense_for_member(conn, expense_id, user["id"]), user["id"])
    # expense_splits rows go too (ON DELETE CASCADE)
    conn.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))


@router.post("/groups/{group_id}/settlements", status_code=201)
def create_settlement(
    group_id: int,
    body: SettlementCreate,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    """The logged-in user records a payment they made to another member."""
    require_member(conn, group_id, user["id"])
    if body.to_user not in _group_member_ids(conn, group_id):
        raise HTTPException(400, "The receiver must be a group member")
    if body.to_user == user["id"]:
        raise HTTPException(400, "Cannot settle with yourself")
    return conn.execute(
        "INSERT INTO settlements (group_id, from_user, to_user, amount) VALUES (%s, %s, %s, %s) "
        "RETURNING id, group_id, from_user, to_user, amount, settled_at",
        (group_id, user["id"], body.to_user, body.amount),
    ).fetchone()
