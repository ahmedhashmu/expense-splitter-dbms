"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Scale, Users } from "lucide-react";
import { api, type Balance, type Group } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/money";
import { AvatarStack, Empty, Modal, SkeletonRows, useToast } from "@/lib/ui";

type GroupRow = Group & { mine: number; people: { id: number; name: string }[] };
type Activity = { id: number; group: string; groupId: number; text: string; by: string | null; at: string };
type Change = { id: number; table_name: string; action: string; changed_at: string; changed_by: string | null;
  old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null };

function activityText(c: Change): string {
  const d = (c.new_data ?? c.old_data ?? {}) as Record<string, unknown>;
  const verb = c.action === "INSERT" ? "added" : c.action === "DELETE" ? "deleted" : "updated";
  if (c.table_name === "expenses") return `${verb} "${d.description}" · ${rupees(Number(d.amount))}`;
  if (c.table_name === "settlements") return `recorded a payment of ${rupees(Number(d.amount))}`;
  if (c.table_name === "group_members") return c.action === "INSERT" ? "added a member" : "removed a member";
  return `${verb} the group`;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<GroupRow[] | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const groups = await api<Group[]>("/groups");
      const details = await Promise.all(
        groups.map(async (g) => {
          const [balances, changes] = await Promise.all([
            api<Balance[]>(`/groups/${g.id}/balances`),
            api<Change[]>(`/groups/${g.id}/history`).catch(() => [] as Change[]),
          ]);
          const me = balances.find((b) => b.user_id === user?.id);
          return {
            row: { ...g, mine: me ? Number(me.balance) : 0, people: balances.map((b) => ({ id: b.user_id, name: b.name })) },
            acts: changes.slice(0, 6).map((c) => ({ id: c.id, group: g.name, groupId: g.id, text: activityText(c), by: c.changed_by, at: c.changed_at })),
          };
        })
      );
      setRows(details.map((d) => d.row));
      setActivity(details.flatMap((d) => d.acts).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8));
    } catch (err) {
      toast((err as Error).message, "err");
      setRows([]);
    }
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
      toast((err as Error).message, "err");
      setBusy(false);
    }
  }

  const owed = (rows ?? []).filter((r) => r.mine > 0).reduce((s, r) => s + r.mine, 0);
  const owe = (rows ?? []).filter((r) => r.mine < 0).reduce((s, r) => s - r.mine, 0);
  const net = owed - owe;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good to see you, {user?.name.split(" ")[0]}</h1>
          <p>Here's where your shared money stands.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New group</button>
      </div>

      <div className="grid-stats" style={{ marginBottom: 28 }}>
        <div className="card stat">
          <div className="k"><ArrowDownLeft size={14} className="plus" /> You're owed</div>
          <div className="v plus">{rows ? rupees(owed) : "—"}</div>
          <div className="s">{(() => { const n = rows?.filter((r) => r.mine > 0).length ?? 0; return `across ${n} ${n === 1 ? "group" : "groups"}`; })()}</div>
        </div>
        <div className="card stat">
          <div className="k"><ArrowUpRight size={14} className="minus" /> You owe</div>
          <div className="v minus">{rows ? rupees(owe) : "—"}</div>
          <div className="s">{(() => { const n = rows?.filter((r) => r.mine < 0).length ?? 0; return `across ${n} ${n === 1 ? "group" : "groups"}`; })()}</div>
        </div>
        <div className="card stat">
          <div className="k"><Scale size={14} /> Net balance</div>
          <div className={`v ${net > 0 ? "plus" : net < 0 ? "minus" : ""}`}>{rows ? `${net < 0 ? "−" : ""}${rupees(net)}` : "—"}</div>
          <div className="s">{net === 0 ? "all square" : net > 0 ? "in your favour" : "to pay back"}</div>
        </div>
      </div>

      <div className="layout-2">
        <section>
          <div className="section-title">Your groups</div>
          {!rows && <div className="card"><SkeletonRows rows={3} /></div>}
          {rows?.length === 0 && (
            <div className="card">
              <Empty icon={Users} title="No groups yet" text="Make one for your flat, a trip or a dinner."
                     action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New group</button>} />
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="groups-grid">
              {rows.map((g) => (
                <a key={g.id} href={`/groups/${g.id}`} className="card group-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{g.people.length} {g.people.length === 1 ? "member" : "members"}</div>
                    </div>
                    <AvatarStack people={g.people} />
                  </div>
                  <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span className="muted" style={{ fontSize: 12.5 }}>{g.mine > 0 ? "you're owed" : g.mine < 0 ? "you owe" : "settled up"}</span>
                    <span className={`num ${g.mine > 0 ? "plus" : g.mine < 0 ? "minus" : "faint"}`} style={{ fontWeight: 650, fontSize: 18 }}>
                      {g.mine === 0 ? "—" : rupees(g.mine)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <aside>
          <div className="section-title">Recent activity</div>
          <div className="card">
            {!rows && <SkeletonRows rows={4} />}
            {rows && activity.length === 0 && <div className="card-body muted">Nothing yet.</div>}
            {activity.map((a) => (
              <a key={`${a.groupId}-${a.id}`} href={`/groups/${a.groupId}/activity`} className="list-row clickable" style={{ alignItems: "flex-start" }}>
                <div className="main">
                  <div style={{ fontSize: 13.5, lineHeight: 1.45 }}><b style={{ fontWeight: 600 }}>{a.by ?? "Someone"}</b> {a.text}</div>
                  <div className="sub">{a.group} · {timeAgo(a.at)}</div>
                </div>
              </a>
            ))}
          </div>
        </aside>
      </div>

      {creating && (
        <Modal title="New group" onClose={() => setCreating(false)} width={440}
               footer={<>
                 <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
                 <button className="btn btn-primary" form="new-group" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create group"}</button>
               </>}>
          <form id="new-group" onSubmit={createGroup}>
            <div className="field">
              <label className="label" htmlFor="gname">Group name</label>
              <input id="gname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hostel room 12, Naran trip…" required autoFocus />
              <span className="hint">You can add people by email once it's created.</span>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
