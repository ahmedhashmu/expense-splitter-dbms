import os
from typing import Any
from collections.abc import Iterator

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# rows come back as dicts (dict_row)
Conn = psycopg.Connection[dict[str, Any]]

# Opening a new connection to Supabase takes about a second, so we keep a few
# open and reuse them. Created on first use so tests don't need a database.
_pool: ConnectionPool[Conn] | None = None


def _get_pool() -> ConnectionPool[Conn]:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            connection_class=psycopg.Connection[dict[str, Any]],
            open=True,
        )
    return _pool


def get_conn() -> Iterator[Conn]:
    """FastAPI dependency: one pooled connection per request.

    The `with` block commits on success and rolls back on an exception,
    so multi-statement writes (expense + splits) are atomic.
    """
    with _get_pool().connection() as conn:
        yield conn
