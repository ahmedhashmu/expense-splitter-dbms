"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, setToken, type User } from "./api";

type AuthState = { user: User | null; loading: boolean; refresh: () => Promise<void>; logout: () => void };

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>("/users/me"));
    } catch {
      setUser(null);
    }
    setLoading(false);
  }

  function logout() {
    setToken(null);
    setUser(null);
    router.replace("/login");
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (loading) return;
    const onLogin = pathname === "/login";
    if (!user && !onLogin) router.replace("/login");
    if (user && onLogin) router.replace("/");
  }, [user, loading, pathname]);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
