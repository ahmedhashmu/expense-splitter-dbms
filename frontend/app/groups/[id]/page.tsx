"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  api,
  type Balance,
  type Expense,
  type ExpenseDetail,
  type Group,
  type Settlement,
  type SplitType,
  type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { niceDate, rupees, settleUp } from "@/lib/money";
import { initials } from "../../Shell";

const today = () => new Date().toISOString().slice(0, 10);

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const groupId = Number(id);
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [groups, m, b, e, p] = await Promise.all([
        api<Group[]>("/groups"),
        api<User[]>(`/groups/${groupId}/members`),
        api<Balance[]>(`/groups/${groupId}/balances`),
        api<Expense[]>(`/groups/${groupId}/expenses`),
        api<Settlement[]>(`/groups/${groupId}/settlements`),
      ]);
      setGroup(groups.find((g) => g.id === groupId) ?? null);
      setMembers(m);
      setBalances(b);
      setExpenses(e);
      setPayments(p);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [groupId]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!group) return <p className="err">{error || "Group not found."} <a href="/">Back to groups</a></p>;

  const isCreator = group.created_by === user?.id;
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <p style={{ margin: "0 0 14px" }}><a href="/">← All groups</a></p>
      <div className="head">
        <div>
          <h1>{group.name}</h1>
          <p>{members.length} {members.length === 1 ? "member" : "members"} · {expenses.length} {expenses.length === 1 ? "expense" : "expenses"} · {rupees(total)} spent so far</p>
        </div>
        {isCreator && <GroupMenu group={group} onChanged={load} />}
      </div>

      {error && <p className="err" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="layout">
        <div>
          <AddExpense groupId={groupId} members={members} me={user!.id} onAdded={load} />
          <ExpenseList expenses={expenses} members={members} me={user!.id} isCreator={isCreator} onChanged={load} />
          {payments.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Payments</h2><span className="hint">money that changed hands</span></div>
              {payments.map((p) => (
                <div key={p.id} className="balance">
                  <span><b>{p.from_name}</b> <span className="arrow">→</span> <b>{p.to_name}</b> <span className="muted">· {niceDate(p.settled_at)}</span></span>
                  <span className="amount">{rupees(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside>
          <Balances balances={balances} me={user!.id} groupId={groupId} members={members} onPaid={load} />
          <Members groupId={groupId} members={members} me={user!.id} creatorId={group.created_by} onChanged={load} />
        </aside>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function GroupMenu({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState("");

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/groups/${group.id}`, { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
      setRenaming(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${group.name}" and all its expenses? This can't be undone.`)) return;
    try {
      await api(`/groups/${group.id}`, { method: "DELETE" });
      location.href = "/";
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (renaming) {
    return (
      <form onSubmit={rename} style={{ display: "flex", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus style={{ width: 220 }} />
        <button>Save</button>
        <button type="button" className="plain" onClick={() => setRenaming(false)}>Cancel</button>
        {error && <p className="err">{error}</p>}
      </form>
    );
  }
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <button type="button" className="text" onClick={() => setRenaming(true)}>Rename</button>
      <button type="button" className="text danger" onClick={remove}>Delete group</button>
      {error && <p className="err">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AddExpense({ groupId, members, me, onAdded }: { groupId: number; members: User[]; me: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(me);
  const [date, setDate] = useState(today());
  const [type, setType] = useState<SplitType>("equal");
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [values, setValues] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIncluded(Object.fromEntries(members.map((m) => [m.id, true])));
  }, [members]);

  const chosen = members.filter((m) => included[m.id]);
  const total = Number(amount) || 0;
  const entered = chosen.reduce((s, m) => s + (Number(values[m.id]) || 0), 0);
  const target = type === "percentage" ? 100 : total;
  const balanced = type === "equal" || Math.abs(entered - target) < 0.005;

  function reset() {
    setDescription("");
    setAmount("");
    setPaidBy(me);
    setDate(today());
    setType("equal");
    setValues({});
    setIncluded(Object.fromEntries(members.map((m) => [m.id, true])));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (chosen.length === 0) return setError("Pick at least one person to split with.");
    if (!balanced) {
      return setError(type === "percentage" ? "Percentages must add up to 100." : "The amounts must add up to the total.");
    }
    setBusy(true);
    try {
      await api(`/groups/${groupId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          amount,
          paid_by: paidBy,
          expense_date: date,
          split_type: type,
          participants: chosen.map((m) => (type === "equal" ? { user_id: m.id } : { user_id: m.id, value: values[m.id] || "0" })),
        }),
      });
      reset();
      setOpen(false);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ width: "100%", padding: 14, marginBottom: 16 }}>
        + Add an expense
      </button>
    );
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>New expense</h2></div>
      <div className="row2">
        <div>
          <label htmlFor="desc">What was it for?</label>
          <input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, pizza, petrol…" required autoFocus />
        </div>
        <div>
          <label htmlFor="amt">Amount (Rs)</label>
          <input id="amt" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
        </div>
      </div>
      <div className="row2">
        <div>
          <label htmlFor="payer">Paid by</label>
          <select id="payer" value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (you)` : m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="when">Date</label>
          <input id="when" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <label>Split</label>
      <div className="seg">
        {(["equal", "exact", "percentage"] as SplitType[]).map((t) => (
          <button key={t} type="button" className={type === t ? "on" : ""} onClick={() => setType(t)}>
            {t === "equal" ? "Equally" : t === "exact" ? "By amount" : "By %"}
          </button>
        ))}
      </div>

      <div className="splits">
        {members.map((m) => (
          <div key={m.id} className="split-row">
            <input type="checkbox" checked={!!included[m.id]} onChange={(e) => setIncluded({ ...included, [m.id]: e.target.checked })} aria-label={`Include ${m.name}`} />
            <span>{m.id === me ? `${m.name} (you)` : m.name}</span>
            {type === "equal" ? (
              <span className="muted" style={{ textAlign: "right" }}>
                {included[m.id] && total > 0 ? rupees(total / chosen.length) : "—"}
              </span>
            ) : (
              <input type="number" min="0" step="0.01" disabled={!included[m.id]} value={values[m.id] ?? ""}
                     onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                     placeholder={type === "percentage" ? "%" : "Rs"} aria-label={`${m.name}'s share`} />
            )}
          </div>
        ))}
      </div>
      {type !== "equal" && (
        <div className="split-total">
          <span>{type === "percentage" ? "Total %" : "Total of shares"}</span>
          <span className={balanced ? "good" : "bad"}>
            {type === "percentage" ? `${entered}% of 100%` : `${rupees(entered)} of ${rupees(total)}`}
          </span>
        </div>
      )}

      <div className="actions">
        <button disabled={busy}>{busy ? "Saving…" : "Save expense"}</button>
        <button type="button" className="plain" onClick={() => { reset(); setOpen(false); setError(""); }}>Cancel</button>
      </div>
      {error && <p className="err">{error}</p>}
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ExpenseList({ expenses, members, me, isCreator, onChanged }: {
  expenses: Expense[]; members: User[]; me: number; isCreator: boolean; onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ExpenseDetail | null>(null);
  const [error, setError] = useState("");
  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);

  async function toggle(id: number) {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    setDetail(null);
    try {
      setDetail(await api<ExpenseDetail>(`/expenses/${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(e: Expense) {
    if (!confirm(`Delete "${e.description}"?`)) return;
    try {
      await api(`/expenses/${e.id}`, { method: "DELETE" });
      setOpenId(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="card-head" style={{ marginTop: 8 }}><h2>Expenses</h2></div>
      {error && <p className="err">{error}</p>}
      <div className="list">
        {expenses.length === 0 && <div className="empty">Nothing added yet.</div>}
        {expenses.map((e) => (
          <div key={e.id}>
            <div className="item" style={{ cursor: "pointer" }} onClick={() => toggle(e.id)}>
              <div className="person">
                <span className="avatar">{initials(e.paid_by_name)}</span>
                <div>
                  <div className="title">{e.description}</div>
                  <div className="sub">
                    {e.paid_by === me ? "You" : e.paid_by_name} paid · {niceDate(e.expense_date)} · <span className="pill">{e.split_type === "equal" ? "equal" : e.split_type === "exact" ? "by amount" : "by %"}</span>
                  </div>
                </div>
              </div>
              <span className="amount">{rupees(e.amount)}</span>
            </div>
            {openId === e.id && (
              <div className="expense-open">
                {!detail && <span className="muted">Loading…</span>}
                {detail?.splits.map((s) => (
                  <div key={s.user_id} className="line">
                    <span>{s.user_id === me ? "You" : names[s.user_id] ?? `User ${s.user_id}`}</span>
                    <span>{rupees(s.share_amount)}</span>
                  </div>
                ))}
                {(e.paid_by === me || isCreator) && (
                  <button type="button" className="text danger" style={{ marginTop: 8, fontSize: 13 }} onClick={() => remove(e)}>Delete expense</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Balances({ balances, me, groupId, members, onPaid }: {
  balances: Balance[]; me: number; groupId: number; members: User[]; onPaid: () => void;
}) {
  const transfers = settleUp(balances);
  const [to, setTo] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function prefill(toId: number, amt: number) {
    setTo(toId);
    setAmount(String(amt));
    setDone("");
    setError("");
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/groups/${groupId}/settlements`, { method: "POST", body: JSON.stringify({ to_user: to, amount }) });
      const name = members.find((m) => m.id === to)?.name;
      setDone(`Recorded ${rupees(amount)} to ${name}.`);
      setTo("");
      setAmount("");
      onPaid();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Balances</h2></div>
      {balances.map((b) => {
        const n = Number(b.balance);
        return (
          <div key={b.user_id} className="balance">
            <div className="person">
              <span className="avatar">{initials(b.name)}</span>
              <div>
                <div>{b.user_id === me ? "You" : b.name}</div>
                <div className="label-sm">{n > 0 ? "gets back" : n < 0 ? "owes" : "settled up"}</div>
              </div>
            </div>
            <span className={`amount ${n > 0 ? "plus" : n < 0 ? "minus" : ""}`}>{n === 0 ? "—" : rupees(n)}</span>
          </div>
        );
      })}

      <div className="card-head" style={{ marginTop: 20, marginBottom: 4 }}>
        <h3>Settle up</h3>
        <span className="hint">{transfers.length === 0 ? "nothing to settle" : `${transfers.length} payment${transfers.length > 1 ? "s" : ""}`}</span>
      </div>
      {transfers.map((t, i) => (
        <div key={i} className="transfer">
          <span>
            <b>{t.from === me ? "You" : t.fromName}</b><span className="arrow">→</span><b>{t.to === me ? "you" : t.toName}</b>
            <span style={{ marginLeft: 6 }}>{rupees(t.amount)}</span>
          </span>
          {t.from === me && <button type="button" className="small plain" onClick={() => prefill(t.to, t.amount)}>I paid</button>}
        </div>
      ))}

      <form onSubmit={pay} style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <h3 style={{ marginBottom: 4 }}>Record a payment</h3>
        <div className="row2">
          <div>
            <label htmlFor="payto">You paid</label>
            <select id="payto" value={to} onChange={(e) => setTo(Number(e.target.value))} required>
              <option value="" disabled>Choose…</option>
              {members.filter((m) => m.id !== me).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="payamt">Amount</label>
            <input id="payamt" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Rs" required />
          </div>
        </div>
        <div className="actions"><button className="plain" disabled={busy}>{busy ? "Saving…" : "Record payment"}</button></div>
        {error && <p className="err">{error}</p>}
        {done && <p className="ok">{done}</p>}
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Members({ groupId, members, me, creatorId, onChanged }: {
  groupId: number; members: User[]; me: number; creatorId: number; onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setEmail("");
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function remove(m: User) {
    const leaving = m.id === me;
    if (!confirm(leaving ? "Leave this group?" : `Remove ${m.name} from the group?`)) return;
    try {
      await api(`/groups/${groupId}/members/${m.id}`, { method: "DELETE" });
      if (leaving) location.href = "/";
      else onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Members</h2><span className="hint">{members.length}</span></div>
      {members.map((m) => (
        <div key={m.id} className="balance">
          <div className="person">
            <span className="avatar">{initials(m.name)}</span>
            <div>
              <div>{m.id === me ? `${m.name} (you)` : m.name}</div>
              <div className="label-sm">{m.id === creatorId ? "created the group" : m.email}</div>
            </div>
          </div>
          {(m.id === me || me === creatorId) && m.id !== creatorId && (
            <button type="button" className="text danger" style={{ fontSize: 13 }} onClick={() => remove(m)}>
              {m.id === me ? "Leave" : "Remove"}
            </button>
          )}
        </div>
      ))}
      <form onSubmit={add} style={{ marginTop: 14 }}>
        <label htmlFor="memail">Add someone by email</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="memail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" required />
          <button className="plain" disabled={busy}>Add</button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>They need a FairShare account first.</p>
        {error && <p className="err">{error}</p>}
      </form>
    </div>
  );
}
