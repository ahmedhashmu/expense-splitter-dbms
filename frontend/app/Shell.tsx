"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Scale } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar, useMenu } from "@/lib/ui";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="brand">
      <span className="brand-mark"><Scale size={15} strokeWidth={2.4} /></span>
      FairShare
    </a>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { open, setOpen, ref } = useMenu();
  if (!user) return null;
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn btn-ghost" style={{ paddingLeft: 6, gap: 8 }} onClick={() => setOpen(!open)} aria-haspopup="menu">
        <Avatar id={user.id} name={user.name} size="sm" />
        <span className="hide-sm" style={{ fontWeight: 500 }}>{user.name}</span>
        <ChevronDown size={15} className="faint" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div style={{ padding: "8px 10px 10px" }}>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{user.email}</div>
          </div>
          <hr />
          <button onClick={logout}><LogOut size={15} /> Log out</button>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname === "/login") return <>{children}</>;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="nav-links">
            <a href="/" className={`nav-link ${pathname === "/" ? "on" : ""}`}>Dashboard</a>
          </nav>
          <div className="spacer" />
          <UserMenu />
        </div>
      </header>
      <main className="page">{user ? children : null}</main>
    </>
  );
}
