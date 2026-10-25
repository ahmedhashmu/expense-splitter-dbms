"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useGroup } from "@/lib/group";
import { rupees } from "@/lib/money";
import { Modal, useToast } from "@/lib/ui";

export default function PaymentModal({ prefill, onClose }: { prefill?: { to: number; amount: number }; onClose: () => void }) {
  const { groupId, members, me, reload } = useGroup();
  const toast = useToast();
  const others = members.filter((m) => m.id !== me);
  const [to, setTo] = useState<number | "">(prefill?.to ?? (others.length === 1 ? others[0].id : ""));
  const [amount, setAmount] = useState(prefill ? String(prefill.amount) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !(Number(amount) > 0)) return setError("Choose who you paid and how much.");
    setBusy(true);
    setError("");
    try {
      await api(`/groups/${groupId}/settlements`, { method: "POST", body: JSON.stringify({ to_user: to, amount }) });
      toast(`Recorded ${rupees(amount)} to ${others.find((m) => m.id === to)?.name}`);
      await reload();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <Modal title="Record a payment" onClose={onClose} width={440}
           footer={<>
             <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
             <button className="btn btn-primary" form="pay" disabled={busy}>{busy ? "Saving…" : "Record payment"}</button>
           </>}>
      <form id="pay" onSubmit={submit}>
        <p className="muted" style={{ marginBottom: 14 }}>Log money you paid back to someone in this group. It updates everyone's balance.</p>
        <div className="field">
          <label className="label" htmlFor="pay-to">You paid</label>
          <select id="pay-to" className="select" value={to} onChange={(e) => setTo(Number(e.target.value))}>
            <option value="" disabled>Choose a person…</option>
            {others.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="pay-amt">Amount</label>
          <div className="prefix">
            <span>Rs</span>
            <input id="pay-amt" className="input input-lg num" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
        </div>
        {error && <div className="notice err">{error}</div>}
      </form>
    </Modal>
  );
}
