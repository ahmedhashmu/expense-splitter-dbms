# FairShare

A group expense splitting database system (DBMS course project).
Friends create a group, record shared expenses, split them equally, by exact amounts
or by percentage, and see who owes whom.

## Stack
| Layer | Tech | Hosting |
|---|---|---|
| Database | PostgreSQL | Supabase |
| Backend | Python, FastAPI, Pydantic, psycopg | Railway |
| Frontend | React / Next.js | Vercel |

Flow: Frontend -> FastAPI -> Supabase Postgres

All queries are plain SQL (no ORM) so joins, views and transactions are visible in the code.

## Project structure
```
db/         schema.sql (tables + user_balances view), seed.sql (demo data)
backend/    FastAPI app
  app/splits.py       split math (equal / exact / percentage), no DB code
  app/routers/        users, groups, expenses + settlements
  tests/              unit tests for the split logic
frontend/   web UI (not started)
docs/       SRS, SDS, DFD (not started)
```

## Database
| Table | Purpose |
|---|---|
| users | people |
| groups | expense groups |
| group_members | users <-> groups (many-to-many) |
| expenses | who paid how much, and the split type |
| expense_splits | each member's share of an expense |
| settlements | repayments between members |

`user_balances` is a view: paid - own share + settlements sent - settlements received.
Positive means others owe that user, negative means the user owes.

## Getting started
1. Create a Supabase project, open the SQL editor, run `db/schema.sql` (and optionally `db/seed.sql`).
2. Set up the backend:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt -r requirements-dev.txt
   cp .env.example .env      # put your Supabase connection string in DATABASE_URL
   uvicorn app.main:app --reload
   ```
3. Open http://localhost:8000/docs for the interactive API docs.

## Tests and type checking
```bash
cd backend
pytest
mypy app
```

## API overview
| Method | Path | What it does |
|---|---|---|
| POST/GET | `/users` | create / list users |
| GET/PUT/DELETE | `/users/{id}` | read / update / delete a user |
| POST/GET | `/groups` | create / list groups |
| POST/GET | `/groups/{id}/members` | add / list members |
| DELETE | `/groups/{id}/members/{user_id}` | remove a member |
| POST/GET | `/groups/{id}/expenses` | add / list expenses |
| GET/PATCH/DELETE | `/expenses/{id}` | read / edit / delete an expense |
| POST | `/groups/{id}/settlements` | record a repayment |
| GET | `/groups/{id}/balances` | who owes whom |

Example expense (equal split between three people):
```json
{
  "paid_by": 1,
  "amount": 900,
  "description": "Groceries",
  "split_type": "equal",
  "participants": [{"user_id": 1}, {"user_id": 2}, {"user_id": 3}]
}
```
For `exact` give `value` as the amount each person owes; for `percentage`, as the percent.

## Deployment notes
- Keep `DATABASE_URL` only in Railway's environment variables, never in the frontend.
- The backend start command on Railway: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
