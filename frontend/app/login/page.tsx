"use client";

import { useState } from "react";
import { api, login } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Brand } from "../Shell";

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

  function useDemo() {
    setMode("login");
    setEmail("ali@example.com");
    setPassword("demo1234");
    setError("");
  }

  return (
    <div className="auth">
      <section className="auth-art">
        <div>
          <Brand />
          <h1>Split the bill. Keep the friends.</h1>
          <p>Add what you paid, split it equally, by amount or by percentage, and FairShare tells everyone exactly who owes whom.</p>

          <div className="receipt" aria-hidden>
            <div className="r-head"><span>Flat 4B · October</span><span>3 people</span></div>
            <div className="r-line"><span>Groceries (Ali)</span><span>Rs 900</span></div>
            <div className="r-line"><span>Internet (Sara)</span><span>Rs 300</span></div>
            <div className="r-line r-total"><span>Bilal pays Ali</span><span>Rs 400</span></div>
            <div className="r-line"><span>Sara pays Ali</span><span>Rs 100</span></div>
          </div>
        </div>
        <div className="foot">Database Management Systems · UBIT</div>
      </section>

      <div className="auth-main">
        <form className="auth-box" onSubmit={submit}>
          <h2>{mode === "login" ? "Welcome back" : "Create an account"}</h2>
          <p className="sub">{mode === "login" ? "Log in to see your groups." : "You'll be splitting bills in a minute."}</p>

          {mode === "register" && (
            <>
              <label htmlFor="name">Your name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ahmed Hashmi" required />
            </>
          )}
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 placeholder={mode === "register" ? "At least 8 characters" : ""} minLength={mode === "register" ? 8 : undefined} required />

          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
          {error && <p className="err">{error}</p>}

          <p className="switch">
            {mode === "login" ? (
              <>New here? <a href="#" onClick={(e) => { e.preventDefault(); setMode("register"); setError(""); }}>Create an account</a></>
            ) : (
              <>Already have one? <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(""); }}>Log in</a></>
            )}
          </p>

          {mode === "login" && (
            <div className="demo">
              Just looking around? <button type="button" className="text" style={{ color: "var(--accent)" }} onClick={useDemo}>Use the demo account</button>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>ali@example.com · demo1234</div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
