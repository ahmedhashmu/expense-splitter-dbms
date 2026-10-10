from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    # bcrypt only uses the first 72 bytes, so cap the length
    password: str = Field(min_length=8, max_length=72)
    phone: str | None = None


class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str | None = None


class User(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class Group(GroupCreate):
    id: int
    created_by: int


class MemberAdd(BaseModel):
    email: EmailStr


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
    # the payer is always the logged-in user
    to_user: int
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class Balance(BaseModel):
    user_id: int
    name: str
    balance: Decimal
