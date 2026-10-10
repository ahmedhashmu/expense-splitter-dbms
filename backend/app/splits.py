"""Pure split logic: turns an expense into per-user share amounts.

Kept free of database code so it is easy to test.
"""
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


class SplitError(ValueError):
    pass


def _fix_rounding(shares: dict[int, Decimal], total: Decimal) -> dict[int, Decimal]:
    """Give any leftover cents to the first user so shares add up exactly."""
    diff = total - sum(shares.values())
    first = next(iter(shares))
    shares[first] += diff
    return shares


def equal_split(total: Decimal, user_ids: list[int]) -> dict[int, Decimal]:
    if not user_ids:
        raise SplitError("At least one participant is required")
    each = (total / len(user_ids)).quantize(CENT, rounding=ROUND_HALF_UP)
    return _fix_rounding({u: each for u in user_ids}, total)


def exact_split(total: Decimal, amounts: dict[int, Decimal]) -> dict[int, Decimal]:
    if sum(amounts.values()) != total:
        raise SplitError("Exact amounts must add up to the expense total")
    return dict(amounts)


def percentage_split(total: Decimal, percents: dict[int, Decimal]) -> dict[int, Decimal]:
    if sum(percents.values()) != Decimal("100"):
        raise SplitError("Percentages must add up to 100")
    shares = {
        u: (total * p / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
        for u, p in percents.items()
    }
    return _fix_rounding(shares, total)
