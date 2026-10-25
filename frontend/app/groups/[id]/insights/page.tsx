"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type Category } from "@/lib/api";
import { useGroup } from "@/lib/group";
import { rupees } from "@/lib/money";
import { CATEGORY_META } from "@/lib/ui";

type Row = Record<string, string | number | null>;
type Report = { title: string; sql: string; rows: Row[] };
type Answer = { answer: string; columns: string[]; rows: Row[] };

const PERSON_COLORS = ["#c2410c", "#0f766e", "#7c3aed", "#1d4ed8", "#be185d", "#a16207", "#4d7c0f", "#475569"];
const SUGGESTIONS = ["How much did we spend on food?", "Which month cost the most?", "Who has paid back money so far?", "What was our biggest expense?"];

const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
const monthShort = (v: string) => new Date(String(v).slice(0, 10)).toLocaleDateString("en-GB", { month: "short" });

function SqlPeek({ sql }: { sql: string }) {
  return (
    <details style={{ marginTop: 12 }}>
      <summary>Show SQL</summary>
      <pre className="sql">{sql}</pre>
    </details>
  );
}

function AnswerTable({ rows }: { rows: Row[] }) {
  const cols = Object.keys(rows[0]);
  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table className="table">
        <thead><tr>{cols.map((c) => <th key={c} className={typeof rows[0][c] === "number" ? "r" : ""}>{c.replaceAll("_", " ")}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => (
              <td key={c} className={typeof r[c] === "number" ? "r" : ""}>
                {typeof r[c] === "number" && /spent|paid|amount|total|share|cost/i.test(c) ? rupees(r[c] as number) : String(r[c] ?? "—")}
              </td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InsightsTab() {
  const { groupId, expenses } = useGroup();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [askError, setAskError] = useState("");

  useEffect(() => {
    api<Report[]>(`/groups/${groupId}/reports`).then(setReports).catch((e) => setError((e as Error).message));
  }, [groupId, expenses.length]);

  const [monthly, payers, categories] = reports ?? [];

  const monthlyChart = useMemo(() => {
    if (!monthly) return { data: [] as Row[], people: [] as string[] };
    const people = [...new Set(monthly.rows.map((r) => String(r.name)))];
    const byMonth = new Map<string, Row>();
    for (const r of monthly.rows) {
      const key = String(r.month);
      const row = byMonth.get(key) ?? { month: key };
      row[String(r.name)] = Number(r.spent);
      byMonth.set(key, row);
    }
    return { data: [...byMonth.values()], people };
  }, [monthly]);

  async function ask(q: string) {
    if (q.trim().length < 3) return;
    setQuestion(q);
    setAsking(true);
    setAskError("");
    setAnswer(null);
    try {
      setAnswer(await api<Answer>(`/groups/${groupId}/ask`, { method: "POST", body: JSON.stringify({ question: q.trim() }) }));
    } catch (err) {
      setAskError((err as Error).message);
    }
    setAsking(false);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card card-pad">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={17} style={{ color: "var(--brand)" }} /> Ask about your spending</h2>
        <p className="muted" style={{ margin: "4px 0 14px" }}>Ask anything about this group's expenses in plain English.</p>
        <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How much did Sara spend on travel?" />
          <button className="btn btn-primary" disabled={asking || question.trim().length < 3}>{asking ? "Thinking…" : "Ask"}</button>
        </form>
        <div className="suggest">
          {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => ask(s)} disabled={asking}>{s}</button>)}
        </div>
        {asking && <div className="answer"><div className="skel" style={{ height: 14, width: "70%" }} /><div className="skel" style={{ height: 14, width: "45%", marginTop: 8 }} /></div>}
        {askError && <div className="notice err">{askError}</div>}
        {answer && (
          <div className="answer">
            <p>{answer.answer}</p>
            {answer.rows.length > 1 && <AnswerTable rows={answer.rows} />}
          </div>
        )}
      </div>

      {error && <div className="notice err">{error}</div>}
      {!reports && !error && <div className="skel" style={{ height: 320, borderRadius: 12 }} />}

      {monthly && (
        <div className="card card-pad">
          <h2>Spending per month</h2>
          <p className="muted" style={{ margin: "2px 0 16px" }}>Each person's share of the group's expenses</p>
          {monthlyChart.data.length === 0 ? <p className="muted">No expenses yet.</p> : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyChart.data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="month" tickFormatter={monthShort} tickLine={false} axisLine={false} fontSize={12} stroke="#78716c" />
                  <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={12} stroke="#78716c" />
                  <Tooltip formatter={(v) => rupees(Number(v))} labelFormatter={(l) => new Date(String(l).slice(0, 10)).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                           contentStyle={{ borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 13 }} cursor={{ fill: "#f5f5f4" }} />
                  {monthlyChart.people.map((p, i) => (
                    <Bar key={p} dataKey={p} stackId="s" fill={PERSON_COLORS[i % PERSON_COLORS.length]}
                         radius={i === monthlyChart.people.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={56} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            {monthlyChart.people.map((p, i) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }} className="muted">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: PERSON_COLORS[i % PERSON_COLORS.length] }} /> {p}
              </span>
            ))}
          </div>
          <SqlPeek sql={monthly.sql} />
        </div>
      )}

      {categories && payers && (
        <div className="layout-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card card-pad">
            <h2>By category</h2>
            {categories.rows.length === 0 ? <p className="muted" style={{ marginTop: 10 }}>No expenses yet.</p> : (
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                <div style={{ width: 160, height: 160 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={categories.rows} dataKey="spent" nameKey="category" innerRadius={48} outerRadius={76} paddingAngle={2} stroke="none">
                        {categories.rows.map((r) => <Cell key={String(r.category)} fill={CATEGORY_META[r.category as Category]?.fg ?? "#a8a29e"} />)}
                      </Pie>
                      <Tooltip formatter={(v) => rupees(Number(v))} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 160, display: "grid", gap: 7 }}>
                  {categories.rows.map((r) => (
                    <div key={String(r.category)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_META[r.category as Category]?.fg }} />
                      <span style={{ flex: 1 }}>{CATEGORY_META[r.category as Category]?.label ?? r.category}</span>
                      <span className="num muted">{r.percent}%</span>
                      <span className="num" style={{ fontWeight: 550, minWidth: 80, textAlign: "right" }}>{rupees(Number(r.spent))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <SqlPeek sql={categories.sql} />
          </div>

          <div className="card card-pad">
            <h2>Who paid the most</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {payers.rows.map((r, i) => {
                const top = Number(payers.rows[0]?.paid ?? 1);
                return (
                  <div key={String(r.name)}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span><b style={{ fontWeight: 600 }}>#{r.rank}</b> {r.name} <span className="muted">· {r.expenses} expenses</span></span>
                      <span className="num" style={{ fontWeight: 600 }}>{rupees(Number(r.paid))}</span>
                    </div>
                    <div style={{ height: 8, background: "#f5f5f4", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(Number(r.paid) / top) * 100}%`, height: "100%", borderRadius: 4, background: PERSON_COLORS[i % PERSON_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {payers.rows.length === 0 && <p className="muted">No expenses yet.</p>}
            </div>
            <SqlPeek sql={payers.sql} />
          </div>
        </div>
      )}
    </div>
  );
}
