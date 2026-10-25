"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { niceDate, rupees } from "@/lib/money";

type Row = Record<string, string | number | null>;
type Report = { title: string; sql: string; rows: Row[] };
type Answer = { question: string; sql: string; note: string; columns: string[]; rows: Row[]; answer: string };

const EXAMPLES = [
  "How much did Sara spend on food?",
  "Which month did we spend the most?",
  "How much has Bilal paid back so far?",
  "What did the Murree trip cost?",
];

const MONEY = /spent|paid|amount|total|running|share/i;

function cell(column: string, value: Row[string]) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && MONEY.test(column)) return rupees(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return column === "month" ? new Date(value.slice(0, 10)).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : niceDate(value);
  }
  return String(value);
}

function Table({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="muted">No rows.</p>;
  const columns = Object.keys(rows[0]);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c} className={typeof rows[0][c] === "number" ? "num" : ""}>{c.replaceAll("_", " ")}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c} className={typeof r[c] === "number" ? "num" : ""}>{cell(c, r[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryBars({ rows }: { rows: Row[] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div key={String(r.category)} style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px", gap: 10, alignItems: "center", fontSize: 14 }}>
          <span style={{ textTransform: "capitalize" }}>{r.category}</span>
          <div style={{ background: "var(--paper)", borderRadius: 4 }}>
            <div className="bar" style={{ width: `${Number(r.percent)}%` }} />
          </div>
          <span style={{ textAlign: "right" }}>{rupees(Number(r.spent))} <span className="muted">({r.percent}%)</span></span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [askError, setAskError] = useState("");

  useEffect(() => {
    api<Report[]>(`/groups/${id}/reports`).then(setReports).catch((e) => setError((e as Error).message));
  }, [id]);

  async function ask(q: string) {
    if (q.trim().length < 3) return;
    setQuestion(q);
    setAsking(true);
    setAskError("");
    setAnswer(null);
    try {
      setAnswer(await api<Answer>(`/groups/${id}/ask`, { method: "POST", body: JSON.stringify({ question: q.trim() }) }));
    } catch (err) {
      setAskError((err as Error).message);
    }
    setAsking(false);
  }

  return (
    <>
      <p style={{ margin: "0 0 14px" }}><a href={`/groups/${id}`}>← Back to the group</a></p>
      <div className="head">
        <div>
          <h1>Reports &amp; Ask AI</h1>
          <p>Every number here comes straight from SQL. Open "Show SQL" to see the query.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h2>Ask your data</h2><span className="hint">powered by Gemini</span></div>
        <form className="ask-box" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How much did we spend on travel?" />
          <button disabled={asking}>{asking ? "Thinking…" : "Ask"}</button>
        </form>
        <div className="chips">
          {EXAMPLES.map((q) => <button key={q} type="button" onClick={() => ask(q)} disabled={asking}>{q}</button>)}
        </div>

        {askError && <p className="err">{askError}</p>}
        {answer && (
          <div>
            <p className="answer">{answer.answer}</p>
            {answer.rows.length > 1 && <div style={{ marginTop: 10 }}><Table rows={answer.rows} /></div>}
          </div>
        )}
      </div>

      {error && <p className="err">{error}</p>}
      {!reports && !error && <p className="muted">Building reports…</p>}
      {reports?.map((r) => (
        <div key={r.title} className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h2>{r.title}</h2></div>
          {r.title.startsWith("Spending by category") ? <CategoryBars rows={r.rows} /> : <Table rows={r.rows} />}
          <details>
            <summary>Show SQL</summary>
            <pre className="sql">{r.sql}</pre>
          </details>
        </div>
      ))}
    </>
  );
}
