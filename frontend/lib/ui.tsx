"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Car, CheckCircle2, CircleAlert, Film, Home, Lightbulb, MoreHorizontal, ShoppingBag, UtensilsCrossed, X,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "./api";

/* ---------- avatars ---------- */

const PALETTE = ["#c2410c", "#0f766e", "#7c3aed", "#be185d", "#1d4ed8", "#a16207", "#4d7c0f", "#475569"];

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export function Avatar({ id, name, size = "" }: { id: number; name: string; size?: "" | "sm" | "lg" }) {
  return (
    <span className={`avatar ${size ? `avatar-${size}` : ""}`} style={{ background: PALETTE[id % PALETTE.length] }} title={name}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: { id: number; name: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((p) => <Avatar key={p.id} id={p.id} name={p.name} size="sm" />)}
      {extra > 0 && <span className="avatar avatar-sm" style={{ background: "#a8a29e" }}>+{extra}</span>}
    </span>
  );
}

/* ---------- categories ---------- */

export const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; fg: string; bg: string }> = {
  food: { label: "Food", icon: UtensilsCrossed, fg: "#c2410c", bg: "#fff1e8" },
  rent: { label: "Rent", icon: Home, fg: "#1d4ed8", bg: "#eff6ff" },
  utilities: { label: "Utilities", icon: Lightbulb, fg: "#a16207", bg: "#fefce8" },
  travel: { label: "Travel", icon: Car, fg: "#0f766e", bg: "#f0fdfa" },
  shopping: { label: "Shopping", icon: ShoppingBag, fg: "#be185d", bg: "#fdf2f8" },
  entertainment: { label: "Entertainment", icon: Film, fg: "#7c3aed", bg: "#f5f3ff" },
  other: { label: "Other", icon: MoreHorizontal, fg: "#57534e", bg: "#f5f5f4" },
};

export function CategoryIcon({ category, size = 36 }: { category: Category; size?: number }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  return (
    <span className="cat-icon" style={{ background: meta.bg, color: meta.fg, width: size, height: size }}>
      <Icon size={Math.round(size * 0.47)} strokeWidth={2} />
    </span>
  );
}

/* ---------- modal ---------- */

export function Modal({ title, onClose, children, footer, width }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- menu (click outside closes) ---------- */

export function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return { open, setOpen, ref };
}

/* ---------- toasts ---------- */

type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastContext = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="ic">{t.kind === "ok" ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------- empty + skeleton ---------- */

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="ic"><Icon size={20} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="list-row">
          <div className="skel" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ width: "40%", height: 12 }} />
            <div className="skel" style={{ width: "25%", height: 10, marginTop: 8 }} />
          </div>
          <div className="skel" style={{ width: 70, height: 14 }} />
        </div>
      ))}
    </div>
  );
}
