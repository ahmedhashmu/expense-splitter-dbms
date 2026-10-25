"""'Ask your data': a question in plain English -> SQL -> answer.

Safety comes from the database, not from trusting the AI:
  * the SQL runs as the role fairshare_ai, which can only SELECT from four views
    in the `ai` schema (no access to any real table, no passwords);
  * those views only show one group, chosen by the setting app.group_id;
  * the transaction is READ ONLY with a 3 second timeout and is rolled back;
  * on top of that, only a single SELECT is accepted and anything that could
    change the group setting is refused.
"""
import json
import os
import re
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from openai import OpenAI, OpenAIError

from app.db import _get_pool

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
# the "lite" model answers in a few seconds; the full flash model can take a minute
MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")
MAX_ROWS = 100

SCHEMA = """\
ai.members (user_id int, name text)                       -- people in this group
ai.expenses (id int, paid_by int, payer_name text, amount numeric, description text,
             category text, expense_date date)            -- category is one of:
             -- food, rent, utilities, travel, shopping, entertainment, other
ai.shares (expense_id int, user_id int, person_name text, share_amount numeric)
             -- each person's share of an expense (what they owe for it)
ai.payments (id int, from_user int, from_name text, to_user int, to_name text,
             amount numeric, paid_on date)                -- money paid back between people"""

SQL_PROMPT = f"""You write one PostgreSQL SELECT query to answer a question about a
shared-expenses group. Only these views exist (already limited to this group):

{SCHEMA}

Rules:
- Return JSON: {{"sql": "...", "note": "one short sentence on how the query answers it"}}.
- One SELECT (a WITH ... SELECT is fine). No semicolon. Never write to the database.
- "spent" or "owes for" means shares (ai.shares); "paid" means ai.expenses.paid_by.
- Use readable column aliases, e.g. total_spent. Months: date_trunc('month', expense_date)::date.
- Match names and descriptions with ILIKE.
- If the question cannot be answered from these views, return {{"sql": "", "note": "why"}}."""

ANSWER_PROMPT = """Answer the user's question in one or two plain sentences using only
the query result given. Amounts are Pakistani rupees, write them like Rs 1,250.
If the result is empty, say nothing matched."""

# anything that is not a plain read, or that could change the group filter
FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|"
    r"set|reset|execute|prepare|listen|notify|vacuum|analyze|lock|"
    r"set_config|current_setting|pg_\w+|dblink\w*|lo_\w+)\b",
    re.IGNORECASE,
)


def _client() -> OpenAI:
    # strip stray spaces, newlines or quotes picked up when pasting the key into a dashboard
    key = os.environ.get("GEMINI_API_KEY", "").strip().strip('"').strip("'").strip()
    if not key:
        raise HTTPException(503, "GEMINI_API_KEY is not set, so questions can't be answered.")
    # the Gemini endpoint drops a connection now and then, so retry a few times
    return OpenAI(api_key=key, base_url=GEMINI_BASE_URL, timeout=30, max_retries=3)


def _chat(client: OpenAI, system: str, user: str, json_mode: bool) -> str:
    extra: dict[str, Any] = {"response_format": {"type": "json_object"}} if json_mode else {}
    try:
        response = client.chat.completions.create(
            model=MODEL,
            temperature=0,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            **extra,
        )
    except OpenAIError as exc:
        raise HTTPException(502, f"The AI service failed: {exc}") from exc
    return (response.choices[0].message.content or "").strip()


def check_sql(sql: str) -> str:
    """Return the cleaned query, or raise if it is not a single plain SELECT."""
    sql = re.sub(r"^```(?:sql)?|```$", "", sql.strip(), flags=re.IGNORECASE).strip()
    sql = sql.rstrip(";").strip()
    if not re.match(r"^(select|with)\b", sql, re.IGNORECASE):
        raise HTTPException(422, "The AI did not produce a SELECT query.")
    if ";" in sql:
        raise HTTPException(422, "Only one query is allowed.")
    bad = FORBIDDEN.search(sql)
    if bad:
        raise HTTPException(422, f"Refused: the query uses '{bad.group(0)}'.")
    return sql


def run_readonly(group_id: int, sql: str) -> tuple[list[str], list[dict[str, Any]]]:
    """Run the query as fairshare_ai, read-only, limited to one group."""
    with _get_pool().connection() as conn:
        try:
            conn.execute("SET TRANSACTION READ ONLY")
            conn.execute("SET LOCAL statement_timeout = '3s'")
            conn.execute("SELECT set_config('app.group_id', %s, true)", (str(group_id),))
            conn.execute("SET LOCAL ROLE fairshare_ai")
            cur = conn.execute(f"SELECT * FROM ({sql}) AS result LIMIT {MAX_ROWS}")  # noqa: S608
            columns = [c.name for c in cur.description or []]
            rows = cur.fetchall()
        except Exception as exc:  # bad SQL, permission denied, timeout...
            conn.rollback()
            raise HTTPException(422, f"The query could not run: {str(exc).splitlines()[0]}") from exc
        conn.rollback()
    return columns, rows


def _jsonable(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


def ask_question(group_id: int, question: str) -> dict[str, Any]:
    client = _client()
    raw = _chat(client, SQL_PROMPT, question, json_mode=True)
    try:
        plan = json.loads(re.sub(r"^```(?:json)?|```$", "", raw.strip()).strip())
    except json.JSONDecodeError as exc:
        raise HTTPException(502, "The AI gave an unreadable reply. Try asking again.") from exc

    if not plan.get("sql"):
        return {"question": question, "sql": "", "note": plan.get("note", ""), "columns": [],
                "rows": [], "answer": plan.get("note") or "That can't be answered from this group's data."}

    sql = check_sql(plan["sql"])
    columns, rows = run_readonly(group_id, sql)

    preview = json.dumps([{k: _jsonable(v) for k, v in r.items()} for r in rows[:30]], default=str)
    answer = _chat(client, ANSWER_PROMPT, f"Question: {question}\nResult: {preview}", json_mode=False)
    return {"question": question, "sql": sql, "note": plan.get("note", ""), "columns": columns,
            "rows": rows, "answer": answer}
