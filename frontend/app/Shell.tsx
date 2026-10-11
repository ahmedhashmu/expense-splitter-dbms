"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function Brand() {
  return (
    <a href="/" className="brand">
      <span className="brand-mark" aria-hidden />
      FairShare
    </a>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login") return <>{children}</>;

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Brand />
          {user && (
            <div className="who">
              <span className="avatar" aria-hidden>{initials(user.name)}</span>
              <span className="email">{user.name}</span>
              <button type="button" className="text" onClick={logout}>Log out</button>
            </div>
          )}
        </div>
      </nav>
      <main className="page">{user ? children : null}</main>
    </>
  );
}
