"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupees } from "@/lib/money";

type Change = {
  id: number;
  table_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_at: string;
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const VERB = { INSERT: "added", UPDATE: "changed", DELETE: "deleted" } as const;

function describe(c: Change): string {
  const d = (c.new_data ?? c.old_data ?? {}) as Record<string, unknown>;
  switch (c.table_name) {
    case "expenses":
      return `${VERB[c.action]} the expense "${d.description}" (${rupees(Number(d.amount))})`;
    case "settlements":
      return `${VERB[c.action]} a payment of ${rupees(Number(d.amount))}`;
    case "group_members":
      return c.action === "INSERT" ? "added a member to the group" : "removed a member from the group";
    case "groups":
      if (c.action === "UPDATE") return `renamed the group to "${d.name}"`;
      return `${VERB[c.action]} the group "${d.name}"`;
    default:
      return `${VERB[c.action]} a row in ${c.table_name}`;
  }
}

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api<Change[]>(`/groups/${id}/history`).then(setChanges).catch((e) => setError((e as Error).message));
  }, [id]);

  return (
    <>
      <p style={{ margin: "0 0 14px" }}><a href={`/groups/${id}`}>← Back to the group</a></p>
      <div className="head">
        <div>
          <h1>History</h1>
          <p>Written automatically by database triggers — the app never writes here itself.</p>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="card">
        {!changes && !error && <p className="muted">Loading…</p>}
        {changes?.length === 0 && <p className="muted">No changes yet.</p>}
        {changes?.map((c) => (
          <div key={c.id}>
            <div className="change" style={{ cursor: "pointer" }} onClick={() => setOpen(open === c.id ? null : c.id)}>
              <span className={`act ${c.action}`}>{c.action}</span>
              <span style={{ flex: 1 }}>
                <b>{c.changed_by ?? "Someone"}</b> {describe(c)}
              </span>
              <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                {new Date(c.changed_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {open === c.id && (
              <pre className="sql">
                {`table: ${c.table_name}\n` +
                  (c.old_data ? `before: ${JSON.stringify(c.old_data, null, 2)}\n` : "") +
                  (c.new_data ? `after:  ${JSON.stringify(c.new_data, null, 2)}` : "")}
              </pre>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
