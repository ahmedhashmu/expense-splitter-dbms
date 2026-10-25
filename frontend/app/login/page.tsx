"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import { api, login } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, CategoryIcon } from "@/lib/ui";
import { Brand } from "../Shell";

const PREVIEW = [
  { id: 1, who: "Ali", what: "Groceries", cat: "food" as const, amount: "Rs 900", note: "you owe Rs 300" },
  { id: 2, who: "Sara", what: "Internet bill", cat: "utilities" as const, amount: "Rs 300", note: "you owe Rs 100" },
  { id: 4, who: "You", what: "Naran trip — hotel", cat: "travel" as const, amount: "Rs 16,000", note: "you lent Rs 12,000" },
];

export default function LoginPage() {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await api("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
      }
      await login(email, password);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
  }

  return (
    <div className="auth">
      <section className="auth-side">
        <div>
          <Brand />
          <h1>Shared money, without the awkward conversations.</h1>
          <p className="lead">
            Log what everyone paid, split it equally, by amount or by percentage, and FairShare works out
            the fewest payments to settle up.
          </p>

          <div className="preview" aria-hidden>
            <div className="preview-head">
              <span style={{ fontWeight: 600 }}>Flat 4B</span>
              <span className="badge badge-plus">you're owed Rs 11,600</span>
            </div>
            {PREVIEW.map((p) => (
              <div key={p.what} className="list-row">
                <CategoryIcon category={p.cat} size={32} />
                <div className="main">
                  <div className="title">{p.what}</div>
                  <div className="sub">{p.who} paid {p.amount}</div>
                </div>
                <span className={`badge ${p.note.startsWith("you lent") ? "badge-plus" : "badge-minus"}`}>{p.note}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="auth-feats">
          <span><ShieldCheck size={15} /> ACID transactions</span>
          <span><BarChart3 size={15} /> Monthly insights</span>
          <span><Sparkles size={15} /> Ask in plain English</span>
        </div>
      </section>

      <main className="auth-main">
        <form className="auth-box" onSubmit={submit}>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="sub">{mode === "login" ? "Log in to see your groups and balances." : "Free, and it takes under a minute."}</p>

          {mode === "register" && (
            <div className="field">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ahmed Hashmi" required autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus autoComplete="email" />
          </div>
          <div className="field">
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                   minLength={mode === "register" ? 8 : undefined} required
                   autoComplete={mode === "register" ? "new-password" : "current-password"} />
          </div>

          {error && <p className="err-text" style={{ marginTop: 12 }}>{error}</p>}

          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20 }} disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            {!busy && <ArrowRight size={16} />}
          </button>

          <p className="muted" style={{ textAlign: "center", marginTop: 18 }}>
            {mode === "login" ? "New to FairShare? " : "Already have an account? "}
            <a href="#" style={{ color: "var(--brand)", fontWeight: 550 }}
               onClick={(e) => { e.preventDefault(); switchMode(mode === "login" ? "register" : "login"); }}>
              {mode === "login" ? "Create an account" : "Log in"}
            </a>
          </p>

          {mode === "login" && (
            <>
              <div className="divider">or</div>
              <button type="button" className="btn btn-secondary btn-block"
                      onClick={() => { setEmail("ali@example.com"); setPassword("demo1234"); setError(""); }}>
                <Avatar id={1} name="Ali" size="sm" /> Fill in the demo account
              </button>
              <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>ali@example.com · demo1234</p>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
