"""Settle up, reports, change history and "Ask your data".

Every query used for a report is returned next to its result, so the website
can show the SQL that produced it.
"""
from typing import Any

from fastapi import APIRouter, Depends

from app.access import require_member
from app.ask import ask_question
from app.auth import CurrentUser, get_current_user
from app.db import Conn, get_conn
from app.schemas import AskBody

router = APIRouter(prefix="/groups/{group_id}", tags=["reports"])


SETTLE_UP_SQL = "SELECT * FROM settle_up(%(g)s)"

MONTHLY_SQL = """\
SELECT m.month, u.name,
       SUM(m.spent) AS spent,
       SUM(SUM(m.spent)) OVER (PARTITION BY m.user_id ORDER BY m.month) AS running_total
FROM reports.monthly_spending m
JOIN users u ON u.id = m.user_id
WHERE m.group_id = %(g)s
GROUP BY m.month, m.user_id, u.name
ORDER BY m.month, u.name"""

TOP_PAYERS_SQL = """\
SELECT u.name,
       SUM(e.amount) AS paid,
       COUNT(*)      AS expenses,
       RANK() OVER (ORDER BY SUM(e.amount) DESC) AS rank
FROM expenses e
JOIN users u ON u.id = e.paid_by
WHERE e.group_id = %(g)s
GROUP BY u.id, u.name
ORDER BY rank"""

CATEGORY_SQL = """\
SELECT category,
       SUM(spent) AS spent,
       ROUND(100 * SUM(spent) / SUM(SUM(spent)) OVER (), 1) AS percent
FROM reports.monthly_spending
WHERE group_id = %(g)s
GROUP BY category
ORDER BY spent DESC"""


def _report(conn: Conn, title: str, sql: str, group_id: int) -> dict[str, Any]:
    return {"title": title, "sql": sql, "rows": conn.execute(sql, {"g": group_id}).fetchall()}


@router.get("/settle-up")
def settle_up(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    """Fewest payments that clear the group — computed by the settle_up() SQL function."""
    require_member(conn, group_id, user["id"])
    return conn.execute(SETTLE_UP_SQL, {"g": group_id}).fetchall()


@router.get("/reports")
def reports(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    require_member(conn, group_id, user["id"])
    # the materialized view stores its result; bring it up to date before reading
    conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY reports.monthly_spending")
    return [
        _report(conn, "Spending per person per month (with running total)", MONTHLY_SQL, group_id),
        _report(conn, "Who paid the most", TOP_PAYERS_SQL, group_id),
        _report(conn, "Spending by category", CATEGORY_SQL, group_id),
    ]


@router.get("/history")
def history(
    group_id: int, user: CurrentUser = Depends(get_current_user), conn: Conn = Depends(get_conn)
):
    """Change log written by the audit triggers, newest first."""
    require_member(conn, group_id, user["id"])
    return conn.execute(
        "SELECT a.id, a.table_name, a.action, a.changed_at, u.name AS changed_by, "
        "a.old_data, a.new_data FROM audit_log a LEFT JOIN users u ON u.id = a.changed_by "
        "WHERE a.group_id = %s ORDER BY a.changed_at DESC, a.id DESC LIMIT 100",
        (group_id,),
    ).fetchall()


@router.post("/ask")
def ask(
    group_id: int,
    body: AskBody,
    user: CurrentUser = Depends(get_current_user),
    conn: Conn = Depends(get_conn),
):
    require_member(conn, group_id, user["id"])
    return ask_question(group_id, body.question)
