"use client";

import { ArrowRight, CheckCircle2, HandCoins } from "lucide-react";
import { nameOf, useGroup } from "@/lib/group";
import { niceDate, rupees } from "@/lib/money";
import { Avatar, Empty } from "@/lib/ui";

export default function BalancesTab() {
  const { balances, transfers, payments, members, me, openPayment } = useGroup();
  const max = Math.max(1, ...balances.map((b) => Math.abs(Number(b.balance))));

  return (
    <div className="layout-2">
      <div style={{ display: "grid", gap: 20 }}>
        <div className="card">
          <div className="card-head"><h2>Balances</h2><span className="hint">green gets money back · red owes</span></div>
          {balances.map((b) => {
            const n = Number(b.balance);
            const width = `${(Math.abs(n) / max) * 100}%`;
            return (
              <div key={b.user_id} className="list-row">
                <Avatar id={b.user_id} name={b.name} />
                <div className="main">
                  <div className="title">{b.user_id === me ? `${b.name} (you)` : b.name}</div>
                  <div style={{ height: 6, background: "#f5f5f4", borderRadius: 3, marginTop: 7, overflow: "hidden" }}>
                    <div style={{ width, height: "100%", borderRadius: 3, background: n > 0 ? "var(--plus)" : n < 0 ? "var(--minus)" : "transparent" }} />
                  </div>
                </div>
                <div className="end" style={{ minWidth: 110 }}>
                  <div className="muted" style={{ fontSize: 11.5 }}>{n > 0 ? "gets back" : n < 0 ? "owes" : "settled"}</div>
                  <div className={`num ${n > 0 ? "plus" : n < 0 ? "minus" : "faint"}`} style={{ fontWeight: 650, fontSize: 15 }}>{n === 0 ? "—" : rupees(n)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Settle up</h2>
            <span className="hint">{transfers.length ? `${transfers.length} payment${transfers.length > 1 ? "s" : ""} clear everything` : ""}</span>
          </div>
          {transfers.length === 0 && <Empty icon={CheckCircle2} title="All settled" text="Nobody owes anybody right now." />}
          {transfers.map((t, i) => (
            <div key={i} className="transfer">
              <Avatar id={t.from_user} name={t.from_name} size="sm" />
              <span style={{ fontWeight: 550 }}>{t.from_user === me ? "You" : t.from_name}</span>
              <ArrowRight size={15} className="arrow" />
              <Avatar id={t.to_user} name={t.to_name} size="sm" />
              <span style={{ fontWeight: 550 }}>{t.to_user === me ? "you" : t.to_name}</span>
              <span className="spacer" />
              <span className="num" style={{ fontWeight: 650 }}>{rupees(t.amount)}</span>
              {t.from_user === me && (
                <button className="btn btn-primary btn-sm" onClick={() => openPayment({ to: t.to_user, amount: Number(t.amount) })}>Settle</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Payments</h2></div>
        {payments.length === 0 && <Empty icon={HandCoins} title="No payments yet" text="When someone pays back, record it here." />}
        {payments.map((p) => (
          <div key={p.id} className="list-row">
            <Avatar id={p.from_user} name={p.from_name} size="sm" />
            <div className="main">
              <div className="title" style={{ fontWeight: 500 }}>
                {nameOf(members, p.from_user, me)} <span className="faint">→</span> {nameOf(members, p.to_user, me)}
              </div>
              <div className="sub">{niceDate(p.settled_at)}</div>
            </div>
            <div className="end num" style={{ fontWeight: 600 }}>{rupees(p.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
