from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = None


class User(UserCreate):
    id: int


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    created_by: int


class Group(GroupCreate):
    id: int


class MemberAdd(BaseModel):
    user_id: int


class Participant(BaseModel):
    user_id: int
    # exact: amount owed, percentage: percent (0-100), equal: ignored
    value: Decimal | None = None


class ExpenseCreate(BaseModel):
    paid_by: int
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    description: str = Field(min_length=1, max_length=255)
    split_type: Literal["equal", "exact", "percentage"] = "equal"
    expense_date: date | None = None
    participants: list[Participant] = Field(min_length=1)


class ExpenseUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=255)
    expense_date: date | None = None


class SettlementCreate(BaseModel):
    from_user: int
    to_user: int
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class Balance(BaseModel):
    user_id: int
    name: str
    balance: Decimal
