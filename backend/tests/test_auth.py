import pytest
from fastapi import HTTPException

from app import auth


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-test-secret-test-secret-123")


def test_password_hash_roundtrip():
    h = auth.hash_password("hunter2hunter2")
    assert h != "hunter2hunter2"
    assert auth.verify_password("hunter2hunter2", h)
    assert not auth.verify_password("wrong-password", h)


def test_token_roundtrip():
    assert auth.decode_token(auth.create_token(42)) == 42


def test_bad_token_is_rejected():
    with pytest.raises(HTTPException) as e:
        auth.decode_token("not-a-token")
    assert e.value.status_code == 401
