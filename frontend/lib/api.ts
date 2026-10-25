/** Talks to the FastAPI backend through the /api proxy (see next.config.js). */

const TOKEN_KEY = "fairshare_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private mode etc. — the user just has to log in again
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && typeof options.body === "string") headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0);
  }

  if (res.status === 401 && token) {
    // token expired — send them back to the login page
    setToken(null);
    if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.href = "/login";
  }

  if (!res.ok) {
    let message = `Something went wrong (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: any) => d.msg).join(", ");
    } catch {
      // not JSON
    }
    throw new ApiError(message, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Login uses the OAuth2 form format: `username` holds the email. */
export async function login(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password });
  const data = await api<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  setToken(data.access_token);
}

export type User = { id: number; name: string; email: string; phone: string | null };
export type Group = { id: number; name: string; created_by: number };
export type Balance = { user_id: number; name: string; balance: string };
export type SplitType = "equal" | "exact" | "percentage";
export const CATEGORIES = ["food", "rent", "utilities", "travel", "shopping", "entertainment", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Expense = {
  id: number;
  paid_by: number;
  paid_by_name: string;
  amount: string;
  description: string;
  split_type: SplitType;
  category: Category;
  expense_date: string;
};
export type ExpenseDetail = Expense & { splits: { user_id: number; share_amount: string }[] };
export type Settlement = {
  id: number;
  from_user: number;
  from_name: string;
  to_user: number;
  to_name: string;
  amount: string;
  settled_at: string;
};

/** One payment from the settle_up() SQL function. */
export type Transfer = { from_user: number; from_name: string; to_user: number; to_name: string; amount: number };
