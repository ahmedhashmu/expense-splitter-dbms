import os
from typing import Any
from collections.abc import Iterator

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# rows come back as dicts (dict_row)
Conn = psycopg.Connection[dict[str, Any]]


def get_conn() -> Iterator[Conn]:
    """FastAPI dependency: one connection per request.

    The `with` block commits on success and rolls back on an exception,
    so multi-statement writes (expense + splits) are atomic.
    """
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn
