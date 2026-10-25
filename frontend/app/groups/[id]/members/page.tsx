"use client";

import { useState } from "react";
import { Crown, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useGroup } from "@/lib/group";
import { Avatar, useToast } from "@/lib/ui";

export default function MembersTab() {
  const { groupId, group, members, me, isCreator, reload } = useGroup();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const added = await api<{ name: string }>(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      toast(`${added.name} joined the group`);
      setEmail("");
      await reload();
    } catch (err) {
      toast((err as Error).message, "err");
    }
    setBusy(false);
  }

  async function remove(id: number, name: string) {
    const leaving = id === me;
    if (!confirm(leaving ? "Leave this group?" : `Remove ${name} from the group?`)) return;
    try {
      await api(`/groups/${groupId}/members/${id}`, { method: "DELETE" });
      if (leaving) location.href = "/";
      else { toast(`${name} was removed`); await reload(); }
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  return (
    <div className="layout-2">
      <div className="card">
        <div className="card-head"><h2>Members</h2><span className="hint">{members.length}</span></div>
        {members.map((m) => (
          <div key={m.id} className="list-row">
            <Avatar id={m.id} name={m.name} />
            <div className="main">
              <div className="title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {m.id === me ? `${m.name} (you)` : m.name}
                {m.id === group.created_by && <span className="badge badge-brand"><Crown size={11} /> creator</span>}
              </div>
              <div className="sub">{m.email}</div>
            </div>
            {m.id !== group.created_by && (m.id === me || isCreator) && (
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--minus)" }} onClick={() => remove(m.id, m.name)}>
                {m.id === me ? "Leave" : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><UserPlus size={17} /> Add someone</h2>
        <p className="muted" style={{ margin: "6px 0 16px" }}>They need a FairShare account first. Enter the email they signed up with.</p>
        <form onSubmit={add}>
          <div className="field">
            <label className="label" htmlFor="memail">Email</label>
            <input id="memail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" required />
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "Adding…" : "Add to group"}</button>
        </form>
        <p className="hint" style={{ marginTop: 14 }}>Someone with expenses or payments in the group can't be removed — it would break the balances.</p>
      </div>
    </div>
  );
}
