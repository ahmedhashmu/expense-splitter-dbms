from fastapi import FastAPI

from app.routers import auth, expenses, groups, users

app = FastAPI(title="FairShare API", version="0.1.0")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(expenses.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
