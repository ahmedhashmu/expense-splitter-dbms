import type { Balance } from "./api";

export function rupees(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  const abs = Math.abs(n);
  const paisa = Math.round(abs * 100) % 100 !== 0;
  return "Rs " + abs.toLocaleString("en-PK", { minimumFractionDigits: paisa ? 2 : 0, maximumFractionDigits: 2 });
}

export function monthLabel(value: string): string {
  const [y, m] = value.slice(0, 7).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function niceDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type Transfer = { from: number; fromName: string; to: number; toName: string; amount: number };

/**
 * Turns net balances into the fewest payments that settle the group:
 * the biggest debtor pays the biggest creditor, repeat.
 */
export function settleUp(balances: Balance[]): Transfer[] {
  const cents = (s: string) => Math.round(Number(s) * 100);
  const owed = balances.filter((b) => cents(b.balance) > 0).map((b) => ({ ...b, left: cents(b.balance) }));
  const owes = balances.filter((b) => cents(b.balance) < 0).map((b) => ({ ...b, left: -cents(b.balance) }));
  owed.sort((a, b) => b.left - a.left);
  owes.sort((a, b) => b.left - a.left);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < owes.length && j < owed.length) {
    const pay = Math.min(owes[i].left, owed[j].left);
    transfers.push({
      from: owes[i].user_id,
      fromName: owes[i].name,
      to: owed[j].user_id,
      toName: owed[j].name,
      amount: pay / 100,
    });
    owes[i].left -= pay;
    owed[j].left -= pay;
    if (owes[i].left === 0) i++;
    if (owed[j].left === 0) j++;
  }
  return transfers;
}
