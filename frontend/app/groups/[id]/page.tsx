"use client";

import { useMemo, useState } from "react";
import { Plus, Receipt, Search, X } from "lucide-react";
import { CATEGORIES, type Expense } from "@/lib/api";
import { useGroup } from "@/lib/group";
import { monthLabel, niceDate, rupees } from "@/lib/money";
import { CATEGORY_META, CategoryIcon, Empty } from "@/lib/ui";

function relation(e: Expense, me: number) {
  const amount = Number(e.amount);
  const mine = Number(e.my_share ?? 0);
  if (e.paid_by === me) {
    const lent = amount - mine;
    return lent > 0 ? { text: "you lent", value: lent, cls: "plus" } : { text: "your own", value: amount, cls: "faint" };
  }
  if (mine > 0) return { text: "you owe", value: mine, cls: "minus" };
  return { text: "not involved", value: 0, cls: "faint" };
}

export default function ExpensesTab() {
  const { expenses, members, me, openExpense, openAddExpense } = useGroup();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [payer, setPayer] = useState("");
  const [month, setMonth] = useState("");

  const months = useMemo(() => [...new Set(expenses.map((e) => e.expense_date.slice(0, 7)))], [expenses]);

  const filtered = expenses.filter((e) =>
    (!q || e.description.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || e.category === cat) &&
    (!payer || String(e.paid_by) === payer) &&
    (!month || e.expense_date.startsWith(month))
  );

  const byMonth = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    for (const e of filtered) {
      const k = e.expense_date.slice(0, 7);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()];
  }, [filtered]);

  const filtering = q || cat || payer || month;
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  if (expenses.length === 0) {
    return (
      <div className="card">
        <Empty icon={Receipt} title="No expenses yet" text="Add the first one — rent, groceries, a dinner out."
               action={<button className="btn btn-primary" onClick={openAddExpense}><Plus size={16} /> Add expense</button>} />
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="input-icon">
          <Search size={15} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expenses" aria-label="Search expenses" />
        </div>
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </select>
        <select className="select" value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Paid by">
          <option value="">Anyone paid</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.id === me ? "You paid" : `${m.name} paid`}</option>)}
        </select>
        <select className="select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">All months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {filtering && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setCat(""); setPayer(""); setMonth(""); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {filtering && (
        <p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
          {filtered.length} of {expenses.length} expenses · <b className="num" style={{ color: "var(--ink)" }}>{rupees(filteredTotal)}</b>
        </p>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        {filtered.length === 0 && <Empty icon={Search} title="Nothing matches" text="Try a different search or clear the filters." />}
        {byMonth.map(([m, items]) => (
          <div key={m}>
            <div className="month-head">
              <span>{monthLabel(m)}</span>
              <span className="num">{rupees(items.reduce((s, e) => s + Number(e.amount), 0))}</span>
            </div>
            {items.map((e) => {
              const r = relation(e, me);
              return (
                <div key={e.id} className="list-row clickable" onClick={() => openExpense(e.id)} role="button" tabIndex={0}
                     onKeyDown={(ev) => ev.key === "Enter" && openExpense(e.id)}>
                  <CategoryIcon category={e.category} />
                  <div className="main">
                    <div className="title">{e.description}</div>
                    <div className="sub">{e.paid_by === me ? "You" : e.paid_by_name} paid <span className="num">{rupees(e.amount)}</span> · {niceDate(e.expense_date)}</div>
                  </div>
                  <div className="end">
                    <div className="muted" style={{ fontSize: 11.5 }}>{r.text}</div>
                    {r.value > 0 && r.cls !== "faint" ? <div className={`num ${r.cls}`} style={{ fontWeight: 600 }}>{rupees(r.value)}</div> : <div className="faint">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
