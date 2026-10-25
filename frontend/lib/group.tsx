"use client";

import { createContext, useContext } from "react";
import type { Balance, Expense, Group, Settlement, Transfer, User } from "./api";

export type GroupData = {
  groupId: number;
  group: Group;
  members: User[];
  balances: Balance[];
  expenses: Expense[];
  payments: Settlement[];
  transfers: Transfer[];
  me: number;
  isCreator: boolean;
  reload: () => Promise<void>;
  openAddExpense: () => void;
  openExpense: (id: number) => void;
  openPayment: (prefill?: { to: number; amount: number }) => void;
};

export const GroupContext = createContext<GroupData | null>(null);

export function useGroup(): GroupData {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroup must be used inside the group layout");
  return ctx;
}

export function nameOf(members: User[], id: number, me?: number) {
  if (id === me) return "You";
  return members.find((m) => m.id === id)?.name ?? `User ${id}`;
}
