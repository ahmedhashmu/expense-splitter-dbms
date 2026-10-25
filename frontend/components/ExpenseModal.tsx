"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api, type ExpenseDetail } from "@/lib/api";
import { nameOf, useGroup } from "@/lib/group";
import { niceDate, rupees } from "@/lib/money";
import { Avatar, CATEGORY_META, CategoryIcon, Modal, useToast } from "@/lib/ui";

export default function ExpenseModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { members, me, isCreator, reload } = useGroup();
  const toast = useToast();
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ExpenseDetail>(`/expenses/${id}`)
      .then((e) => { setExpense(e); setDescription(e.description); setDate(e.expense_date.slice(0, 10)); })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const canEdit = expense && (expense.paid_by === me || isCreator);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify({ description: description.trim(), expense_date: date }) });
      toast("Expense updated");
      await reload();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function remove() {
    if (!expense || !confirm(`Delete "${expense.description}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      toast("Expense deleted");
      await reload();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit expense" : "Expense"} onClose={onClose} width={500}
           footer={expense && canEdit ? (editing ? (
             <>
               <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
               <button className="btn btn-primary" onClick={save} disabled={busy || !description.trim()}>{busy ? "Saving…" : "Save changes"}</button>
             </>
           ) : (
             <>
               <button className="btn btn-danger" onClick={remove} disabled={busy} style={{ marginRight: "auto" }}><Trash2 size={15} /> Delete</button>
               <button className="btn btn-secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
             </>
           )) : undefined}>
      {!expense && !error && <div className="skel" style={{ height: 120 }} />}
      {error && <div className="notice err" style={{ marginTop: 0 }}>{error}</div>}
      {expense && !editing && (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <CategoryIcon category={expense.category} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{expense.description}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {CATEGORY_META[expense.category]?.label} · {niceDate(expense.expense_date)} · {expense.split_type === "equal" ? "split equally" : expense.split_type === "exact" ? "split by amount" : "split by %"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.03em", margin: "18px 0 4px" }} className="num">{rupees(expense.amount)}</div>
          <div className="muted" style={{ fontSize: 13 }}>paid by <b style={{ color: "var(--ink)" }}>{nameOf(members, expense.paid_by, me)}</b></div>

          <div className="section-title" style={{ marginTop: 22 }}>Who owes what</div>
          <div className="card">
            {expense.splits.map((s) => (
              <div key={s.user_id} className="list-row">
                <Avatar id={s.user_id} name={nameOf(members, s.user_id)} size="sm" />
                <div className="main"><div className="title" style={{ fontWeight: 500 }}>{nameOf(members, s.user_id, me)}</div></div>
                <div className="end num" style={{ fontWeight: 550 }}>{rupees(s.share_amount)}</div>
              </div>
            ))}
          </div>
          {!canEdit && <p className="hint" style={{ marginTop: 12 }}>Only the person who paid or the group creator can change this expense.</p>}
        </>
      )}
      {expense && editing && (
        <>
          <div className="field">
            <label className="label" htmlFor="ed-desc">Description</label>
            <input id="ed-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="ed-date">Date</label>
            <input id="ed-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <p className="hint" style={{ marginTop: 12 }}>The amount and split can't change after saving — delete it and add it again instead.</p>
        </>
      )}
    </Modal>
  );
}
