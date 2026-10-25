"use client";

import { useEffect, useState } from "react";
import { Activity, Minus, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useGroup } from "@/lib/group";
import { rupees } from "@/lib/money";
import { Empty, SkeletonRows } from "@/lib/ui";

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
const ICON = { INSERT: Plus, UPDATE: Pencil, DELETE: Minus } as const;

function describe(c: Change): React.ReactNode {
  const d = (c.new_data ?? c.old_data ?? {}) as Record<string, unknown>;
  switch (c.table_name) {
    case "expenses": {
      if (c.action === "UPDATE" && c.old_data && c.new_data && c.old_data.description !== c.new_data.description) {
        return <>renamed an expense from <b>"{String(c.old_data.description)}"</b> to <b>"{String(c.new_data.description)}"</b></>;
      }
      return <>{VERB[c.action]} <b>"{String(d.description)}"</b> · {rupees(Number(d.amount))}</>;
    }
    case "settlements":
      return <>{VERB[c.action]} a payment of <b>{rupees(Number(d.amount))}</b></>;
    case "group_members":
      return c.action === "INSERT" ? "added a member" : "removed a member";
    case "groups":
      return c.action === "UPDATE" ? <>renamed the group to <b>"{String(d.name)}"</b></> : <>{VERB[c.action]} the group</>;
    default:
      return `${VERB[c.action]} a row in ${c.table_name}`;
  }
}

export default function ActivityTab() {
  const { groupId, expenses, payments } = useGroup();
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api<Change[]>(`/groups/${groupId}/history`).then(setChanges).catch((e) => setError((e as Error).message));
  }, [groupId, expenses.length, payments.length]);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Activity</h2>
        <span className="hint">recorded automatically by the database</span>
      </div>
      {error && <div className="card-body err-text">{error}</div>}
      {!changes && !error && <SkeletonRows rows={5} />}
      {changes?.length === 0 && <Empty icon={Activity} title="No activity yet" />}
      {changes?.map((c) => {
        const Icon = ICON[c.action];
        return (
          <div key={c.id}>
            <div className="timeline-row" style={{ cursor: "pointer" }} onClick={() => setOpen(open === c.id ? null : c.id)}>
              <span className={`dot ${c.action}`}><Icon size={14} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ lineHeight: 1.5 }}><b style={{ fontWeight: 600 }}>{c.changed_by ?? "Someone"}</b> {describe(c)}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(c.changed_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            {open === c.id && (
              <div style={{ padding: "0 20px 14px 60px" }}>
                <pre className="sql" style={{ marginTop: 0 }}>
                  {(c.old_data ? `before ${JSON.stringify(c.old_data, null, 2)}\n` : "") + (c.new_data ? `after  ${JSON.stringify(c.new_data, null, 2)}` : "")}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
