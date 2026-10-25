"use client";

import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { api, CATEGORIES, type Category, type SplitType } from "@/lib/api";
import { useGroup } from "@/lib/group";
import { rupees } from "@/lib/money";
import { Avatar, CATEGORY_META, Modal, useToast } from "@/lib/ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const { groupId, members, me, reload } = useGroup();
  const toast = useToast();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("food");
  const [paidBy, setPaidBy] = useState(me);
  const [date, setDate] = useState(today());
  const [type, setType] = useState<SplitType>("equal");
  const [included, setIncluded] = useState<Record<number, boolean>>(() => Object.fromEntries(members.map((m) => [m.id, true])));
  const [values, setValues] = useState<Record<number, string>>({});
  const [simulate, setSimulate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rolledBack, setRolledBack] = useState("");

  const chosen = members.filter((m) => included[m.id]);
  const total = Number(amount) || 0;
  const entered = useMemo(() => chosen.reduce((s, m) => s + (Number(values[m.id]) || 0), 0), [chosen, values]);
  const target = type === "percentage" ? 100 : total;
  const balanced = type === "equal" || Math.abs(entered - target) < 0.005;
  const ready = description.trim() && total > 0 && chosen.length > 0 && balanced;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRolledBack("");
    if (!ready) {
      setError(!balanced ? (type === "percentage" ? "Percentages must add up to 100." : "Shares must add up to the total.") : "Fill in what it was for, the amount and who shares it.");
      return;
    }
    setBusy(true);
    try {
      await api(`/groups/${groupId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(), amount, paid_by: paidBy, expense_date: date, split_type: type, category,
          simulate_failure: simulate,
          participants: chosen.map((m) => (type === "equal" ? { user_id: m.id } : { user_id: m.id, value: values[m.id] || "0" })),
        }),
      });
      toast(`Added "${description.trim()}" · ${rupees(total)}`);
      await reload();
      onClose();
    } catch (err) {
      const ex = err as Error & { status?: number };
      if (simulate && ex.status === 409) {
        setRolledBack(ex.message);
        setSimulate(false); // the next save is a real one
        await reload();
      } else {
        setError(ex.message);
      }
    }
    setBusy(false);
  }

  return (
    <Modal title="Add an expense" onClose={onClose} width={560}
           footer={<>
             <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
             <button className="btn btn-primary" form="add-expense" disabled={busy}>
               {busy ? "Saving…" : simulate ? "Save and crash" : "Save expense"}
             </button>
           </>}>
      <form id="add-expense" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="amt">Amount</label>
          <div className="prefix">
            <span>Rs</span>
            <input id="amt" className="input input-lg num" type="number" inputMode="decimal" min="0.01" step="0.01"
                   value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="desc">What was it for?</label>
          <input id="desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, pizza, petrol…" maxLength={255} />
        </div>

        <div className="field">
          <span className="label">Category</span>
          <div className="cat-chips">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_META[c].icon;
              return (
                <button key={c} type="button" className={`cat-chip ${category === c ? "on" : ""}`} onClick={() => setCategory(c)}>
                  <Icon size={14} /> {CATEGORY_META[c].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="row2" style={{ marginTop: 14 }}>
          <div className="field" style={{ marginTop: 0 }}>
            <label className="label" htmlFor="payer">Paid by</label>
            <select id="payer" className="select" value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginTop: 0 }}>
            <label className="label" htmlFor="when">Date</label>
            <input id="when" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="label">Split between</span>
            <div className="seg">
              {(["equal", "exact", "percentage"] as SplitType[]).map((t) => (
                <button key={t} type="button" className={type === t ? "on" : ""} onClick={() => setType(t)}>
                  {t === "equal" ? "Equally" : t === "exact" ? "By amount" : "By %"}
                </button>
              ))}
            </div>
          </div>
          <div>
            {members.map((m) => (
              <div key={m.id} className="split-row">
                <input type="checkbox" checked={!!included[m.id]} onChange={(e) => setIncluded({ ...included, [m.id]: e.target.checked })} aria-label={`Include ${m.name}`} style={{ accentColor: "var(--brand)" }} />
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar id={m.id} name={m.name} size="sm" /> {m.id === me ? `${m.name} (you)` : m.name}
                </span>
                {type === "equal" ? (
                  <span className="num muted" style={{ textAlign: "right" }}>{included[m.id] && total > 0 ? rupees(total / chosen.length) : "—"}</span>
                ) : (
                  <input className="input num" type="number" min="0" step="0.01" disabled={!included[m.id]}
                         value={values[m.id] ?? ""} onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                         placeholder={type === "percentage" ? "%" : "Rs"} aria-label={`${m.name}'s share`} />
                )}
              </div>
            ))}
          </div>
          {type !== "equal" && (
            <div className="split-total">
              <span className="muted">{type === "percentage" ? "Total" : "Shares add up to"}</span>
              <b className={balanced ? "plus" : "minus"}>{type === "percentage" ? `${entered}% of 100%` : `${rupees(entered)} of ${rupees(total)}`}</b>
            </div>
          )}
        </div>

        <div className="demo-box">
          <label className="check">
            <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
            <span>
              <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><FlaskConical size={14} /> Transaction demo</span>
              <span className="hint" style={{ display: "block" }}>Crash after the expense and one share are written, to show the database rolling it all back.</span>
            </span>
          </label>
        </div>

        {error && <div className="notice err">{error}</div>}
        {rolledBack && (
          <div className="notice err">
            <RotateCcw size={16} style={{ flex: "none", marginTop: 2 }} />
            <div>
              <b>Rolled back — nothing was saved.</b>
              <div style={{ marginTop: 2 }}>{rolledBack}</div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
