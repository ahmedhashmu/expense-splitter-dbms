"use client";

import { useEffect, useState } from "react";
import { api, type Balance, type Group } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/money";

type Row = Group & { mine: number; members: number };

export default function GroupsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const groups = await api<Group[]>("/groups");
      const withBalances = await Promise.all(
        groups.map(async (g) => {
          const balances = await api<Balance[]>(`/groups/${g.id}/balances`);
          const me = balances.find((b) => b.user_id === user?.id);
          return { ...g, mine: me ? Number(me.balance) : 0, members: balances.length };
        })
      );
      setRows(withBalances);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const g = await api<Group>("/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      location.href = `/groups/${g.id}`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const owed = rows.filter((r) => r.mine > 0).reduce((s, r) => s + r.mine, 0);
  const owe = rows.filter((r) => r.mine < 0).reduce((s, r) => s - r.mine, 0);

  return (
    <>
      <div className="head">
        <div>
          <h1>Hi {user?.name.split(" ")[0]}</h1>
          <p>
            {loading ? "Adding things up…" :
              owed === 0 && owe === 0 ? "You're all settled up." :
              <>
                {owed > 0 && <>You're owed <span className="plus">{rupees(owed)}</span></>}
                {owed > 0 && owe > 0 && " and "}
                {owe > 0 && <>you owe <span className="minus">{rupees(owe)}</span></>}
                {" in total."}
              </>}
          </p>
        </div>
        {!creating && <button type="button" onClick={() => setCreating(true)}>+ New group</button>}
      </div>

      {creating && (
        <form className="card" onSubmit={createGroup} style={{ marginBottom: 20, maxWidth: 520 }}>
          <label htmlFor="gname">Group name</label>
          <input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hostel room 12, Murree trip…" required autoFocus />
          <div className="actions">
            <button disabled={busy}>{busy ? "Creating…" : "Create group"}</button>
            <button type="button" className="plain" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="err" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="list">
        {loading && <div className="empty">Loading your groups…</div>}
        {!loading && rows.length === 0 && (
          <div className="empty">No groups yet. Make one for your flat, a trip or a dinner.</div>
        )}
        {rows.map((g) => (
          <a key={g.id} href={`/groups/${g.id}`} className="item">
            <div>
              <div className="title">{g.name}</div>
              <div className="sub">{g.members} {g.members === 1 ? "member" : "members"}{g.created_by === user?.id ? " · you made this" : ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {g.mine === 0 ? (
                <span className="muted">settled</span>
              ) : (
                <>
                  <div className="muted" style={{ fontSize: 12 }}>{g.mine > 0 ? "you're owed" : "you owe"}</div>
                  <div className={`amount ${g.mine > 0 ? "plus" : "minus"}`}>{rupees(g.mine)}</div>
                </>
              )}
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
