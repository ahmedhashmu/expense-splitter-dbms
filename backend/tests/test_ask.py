import pytest
from fastapi import HTTPException

from app.ask import check_sql


def test_plain_select_is_allowed():
    assert check_sql("SELECT name FROM ai.members;") == "SELECT name FROM ai.members"
    assert check_sql("```sql\nWITH t AS (SELECT 1) SELECT * FROM t\n```").startswith("WITH")


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM ai.expenses",
        "SELECT 1; DROP TABLE users",
        "SELECT set_config('app.group_id', '2', true)",
        "SELECT current_setting('app.group_id')",
        "SELECT * FROM pg_catalog.pg_user",
        "UPDATE users SET name = 'x'",
    ],
)
def test_dangerous_sql_is_refused(sql):
    with pytest.raises(HTTPException):
        check_sql(sql)
