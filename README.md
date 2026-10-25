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
frontend/   Next.js website (talks to the API through its /api proxy)
start.sh    runs the API and the website together for a local demo
```

## DBMS features (what to show)
| Feature | Where |
|---|---|
| **Transactions + rollback** — an expense and all its shares are one transaction; "Transaction demo" on the add-expense form crashes half way and nothing is saved | `routers/expenses.py`, add-expense form |
| **Constraint trigger** — the database itself rejects shares that don't add up to the expense (checked at COMMIT) | `split_total_matches` in `db/migrations/002_dbms_features.sql` |
| **Audit trail** — triggers log every change to groups, members, expenses and payments, with who did it | `audit_log` table, **History** page |
| **Stored function** — "settle up" (fewest payments that clear the group) runs in PL/pgSQL | `settle_up(group_id)` |
| **Materialized view + window functions** — monthly spending with running totals, ranking, category shares | `reports.monthly_spending`, **Reports** page |
| **Indexes** — on the columns the app filters and joins by; `EXPLAIN ANALYZE` demo shows ~20x faster lookups | `db/demo/dbms-demo.sql` |
| **Ask your data (AI)** — Gemini turns a question into SQL, which runs as the read-only role `fairshare_ai` that can only see four views of one group | `app/ask.py`, **Reports & Ask AI** page |

`db/demo/dbms-demo.sql` has every feature as a block to run live in the Supabase SQL editor; nothing in it changes real data.

## Database
| Table | Purpose |
|---|---|
| users | people |
| groups | expense groups |
| group_members | users <-> groups (many-to-many) |
| expenses | who paid how much, and the split type |
| expense_splits | each member's share of an expense |
| settlements | repayments between members |

| audit_log | change history, written by triggers |

`user_balances` is a view: paid - own share + settlements sent - settlements received.
Positive means others owe that user, negative means the user owes.

## Quick start (demo on this laptop)
```bash
./start.sh
```
Opens http://localhost:3000. Log in with the demo account `ali@example.com` / `demo1234`.
The first run installs the Python and Node packages; `backend/.env` must exist (see below).

## Getting started
1. Create a Supabase project, open the SQL editor, run `db/schema.sql`, then `db/migrations/002_dbms_features.sql` and `003_ai_category_text.sql`. For demo data also run `db/seed.sql` and `db/seed_more.sql` (demo users log in with password `demo1234`).
   If you ran an older schema, run `db/migrations/001_add_password_hash.sql` instead.
2. Set up the backend:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt -r requirements-dev.txt
   cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET and GEMINI_API_KEY
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
Everything except `/auth/*` and `/health` needs a login token
(`Authorization: Bearer <token>`). In `/docs`, click **Authorize** and log in with email + password.
Users only ever see groups they belong to.

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/register` | create an account |
| POST | `/auth/login` | email + password -> token |
| GET/PUT/DELETE | `/users/me` | my profile |
| POST/GET | `/groups` | create a group / list my groups |
| PUT/DELETE | `/groups/{id}` | rename / delete (creator only) |
| POST/GET | `/groups/{id}/members` | add by email / list members |
| DELETE | `/groups/{id}/members/{user_id}` | leave, or creator removes someone |
| POST/GET | `/groups/{id}/expenses` | add / list expenses |
| GET/PATCH/DELETE | `/expenses/{id}` | read / edit / delete (payer or group creator) |
| POST | `/groups/{id}/settlements` | record a payment I made to a member |
| GET | `/groups/{id}/settlements` | payment history |
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
- The backend start command on Railway: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (root directory `backend`).
- Vercel: root directory `frontend`, set `BACKEND_URL` to the Railway URL. The website forwards `/api/*` to it, so the API needs no CORS setup.
