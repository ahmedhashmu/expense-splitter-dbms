from decimal import Decimal as D

import pytest

from app.splits import SplitError, equal_split, exact_split, percentage_split


def test_equal_split_even():
    assert equal_split(D("900"), [1, 2, 3]) == {1: D("300.00"), 2: D("300.00"), 3: D("300.00")}


def test_equal_split_remainder_goes_to_first_user():
    shares = equal_split(D("100"), [1, 2, 3])
    assert sum(shares.values()) == D("100")
    assert shares[1] == D("33.34")


def test_exact_split_must_match_total():
    with pytest.raises(SplitError):
        exact_split(D("100"), {1: D("60"), 2: D("30")})


def test_percentage_split():
    shares = percentage_split(D("200"), {1: D("50"), 2: D("30"), 3: D("20")})
    assert shares == {1: D("100.00"), 2: D("60.00"), 3: D("40.00")}


def test_percentage_must_total_100():
    with pytest.raises(SplitError):
        percentage_split(D("100"), {1: D("50"), 2: D("40")})
