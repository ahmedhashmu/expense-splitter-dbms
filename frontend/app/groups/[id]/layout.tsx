"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import {
  Activity, ArrowLeft, BarChart3, Download, HandCoins, MoreHorizontal, Pencil, Plus, Receipt, Trash2, Users, Wallet,
} from "lucide-react";
import {
  api, type Balance, type Expense, type Group, type Settlement, type Transfer, type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GroupContext, type GroupData } from "@/lib/group";
import { rupees } from "@/lib/money";
import { AvatarStack, Modal, useMenu, useToast } from "@/lib/ui";
import AddExpenseModal from "@/components/AddExpenseModal";
import ExpenseModal from "@/components/ExpenseModal";
import PaymentModal from "@/components/PaymentModal";

const TABS = [
  { href: "", label: "Expenses", icon: Receipt },
  { href: "/balances", label: "Balances", icon: Wallet },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/members", label: "Members", icon: Users },
];

function exportCsv(group: Group, expenses: Expense[]) {
  const head = ["Date", "Description", "Category", "Paid by", "Amount (Rs)", "Split", "Your share (Rs)"];
  const rows = expenses.map((e) => [e.expense_date.slice(0, 10), e.description, e.category, e.paid_by_name, e.amount, e.split_type, e.my_share ?? ""]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${group.name.replace(/\W+/g, "-")}-expenses.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const pathname = usePathname();
  const { user } = useAuth();
  const toast = useToast();
  const menu = useMenu();

  const [data, setData] = useState<Omit<GroupData, "reload" | "openAddExpense" | "openExpense" | "openPayment" | "me" | "isCreator" | "groupId"> | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<null | { kind: "add" } | { kind: "expense"; id: number } | { kind: "pay"; prefill?: { to: number; amount: number } } | { kind: "rename" }>(null);
  const [newName, setNewName] = useState("");

  const reload = useCallback(async () => {
    try {
      const [groups, members, balances, expenses, payments, transfers] = await Promise.all([
        api<Group[]>("/groups"),
        api<User[]>(`/groups/${groupId}/members`),
        api<Balance[]>(`/groups/${groupId}/balances`),
        api<Expense[]>(`/groups/${groupId}/expenses`),
        api<Settlement[]>(`/groups/${groupId}/settlements`),
        api<Transfer[]>(`/groups/${groupId}/settle-up`).catch(() => [] as Transfer[]),
      ]);
      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error("Group not found");
      setData({ group, members, balances, expenses, payments, transfers });
    } catch (err) {
      setError((err as Error).message);
    }
  }, [groupId]);

  useEffect(() => { reload(); }, [reload]);

  // on phones the tab row scrolls sideways: keep the open tab in view
  useEffect(() => {
    document.querySelector(".tab.on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname, data]);

  if (error) return <div className="card card-pad"><p className="err-text">{error}</p><a href="/" className="btn btn-secondary" style={{ marginTop: 12 }}>Back to dashboard</a></div>;
  if (!data || !user) {
    return (
      <>
        <div className="skel" style={{ width: 220, height: 28 }} />
        <div className="skel" style={{ width: 160, height: 14, marginTop: 10 }} />
        <div className="skel" style={{ height: 300, marginTop: 28, borderRadius: 12 }} />
      </>
    );
  }

  const me = user.id;
  const isCreator = data.group.created_by === me;
  const myBalance = Number(data.balances.find((b) => b.user_id === me)?.balance ?? 0);
  const total = data.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const base = `/groups/${groupId}`;

  const ctx: GroupData = {
    ...data, groupId, me, isCreator, reload,
    openAddExpense: () => setModal({ kind: "add" }),
    openExpense: (eid) => setModal({ kind: "expense", id: eid }),
    openPayment: (prefill) => setModal({ kind: "pay", prefill }),
  };

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/groups/${groupId}`, { method: "PUT", body: JSON.stringify({ name: newName.trim() }) });
      toast("Group renamed");
      setModal(null);
      reload();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function deleteGroup() {
    menu.setOpen(false);
    if (!confirm(`Delete "${data!.group.name}" with all its expenses and payments? This can't be undone.`)) return;
    try {
      await api(`/groups/${groupId}`, { method: "DELETE" });
      location.href = "/";
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  return (
    <GroupContext.Provider value={ctx}>
      <a href="/" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={14} /> Dashboard
      </a>

      <div className="page-head" style={{ marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <h1>{data.group.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <AvatarStack people={data.members.map((m) => ({ id: m.id, name: m.name }))} max={6} />
            <span className="muted" style={{ fontSize: 13 }}>{data.members.length} members · {rupees(total)} spent</span>
            <span className={`badge ${myBalance > 0 ? "badge-plus" : myBalance < 0 ? "badge-minus" : ""}`}>
              {myBalance > 0 ? `you're owed ${rupees(myBalance)}` : myBalance < 0 ? `you owe ${rupees(myBalance)}` : "you're settled up"}
            </span>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => setModal({ kind: "pay" })} disabled={data.members.length < 2}>
            <HandCoins size={16} /> Record payment
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ kind: "add" })}><Plus size={16} /> Add expense</button>
          <div className="menu-wrap" ref={menu.ref}>
            <button className="btn btn-secondary icon-btn" onClick={() => menu.setOpen(!menu.open)} aria-label="More actions"><MoreHorizontal size={17} /></button>
            {menu.open && (
              <div className="menu">
                <button onClick={() => { menu.setOpen(false); exportCsv(data.group, data.expenses); }}><Download size={15} /> Export expenses (CSV)</button>
                {isCreator && <button onClick={() => { menu.setOpen(false); setNewName(data.group.name); setModal({ kind: "rename" }); }}><Pencil size={15} /> Rename group</button>}
                {isCreator && <><hr /><button className="danger" onClick={deleteGroup}><Trash2 size={15} /> Delete group</button></>}
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="tabs">
        {TABS.map((t) => {
          const href = base + t.href;
          const on = pathname === href;
          const Icon = t.icon;
          return <a key={t.label} href={href} className={`tab ${on ? "on" : ""}`}><Icon size={15} /> {t.label}</a>;
        })}
      </nav>

      {children}

      {modal?.kind === "add" && <AddExpenseModal onClose={() => setModal(null)} />}
      {modal?.kind === "expense" && <ExpenseModal id={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === "pay" && <PaymentModal prefill={modal.prefill} onClose={() => setModal(null)} />}
      {modal?.kind === "rename" && (
        <Modal title="Rename group" onClose={() => setModal(null)} width={420}
               footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                 <button className="btn btn-primary" form="rename" disabled={!newName.trim()}>Save</button></>}>
          <form id="rename" onSubmit={rename}>
            <div className="field"><label className="label" htmlFor="rn">Group name</label>
              <input id="rn" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus /></div>
          </form>
        </Modal>
      )}
    </GroupContext.Provider>
  );
}
