import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_ACCOUNTS } from "./categories";
import { inRange, periodRange } from "./period";
import type { Account, PeriodKey, Transaction, TransactionType } from "./types";
import { createId } from "@/lib/utils";

function seedAccounts(): Account[] {
  const now = new Date().toISOString();
  return DEFAULT_ACCOUNTS.map((a, i) => ({
    id: `acc-default-${i}-${a.type}`,
    name: a.name,
    type: a.type,
    currentBalance: 0,
    color: a.color,
    archived: false,
    createdAt: now,
  }));
}

function applyTx(accounts: Account[], tx: Transaction, direction: 1 | -1): Account[] {
  return accounts.map((a) => {
    if (tx.type === "income" && a.id === tx.accountId) {
      return { ...a, currentBalance: a.currentBalance + direction * tx.amount };
    }
    if (tx.type === "expense" && a.id === tx.accountId) {
      if (a.type === "credit") {
        return { ...a, currentBalance: a.currentBalance + direction * tx.amount };
      }
      return { ...a, currentBalance: a.currentBalance - direction * tx.amount };
    }
    if (tx.type === "transfer") {
      if (a.id === tx.accountId) {
        return { ...a, currentBalance: a.currentBalance - direction * tx.amount };
      }
      if (a.id === tx.toAccountId) {
        const delta = a.type === "credit" ? -direction * tx.amount : direction * tx.amount;
        return { ...a, currentBalance: a.currentBalance + delta };
      }
    }
    return a;
  });
}

const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

interface FinanceState {
  accounts: Account[];
  transactions: Transaction[];
  addAccount: (input: { name: string; type: Account["type"] }) => void;
  addTransaction: (input: {
    type: TransactionType;
    title: string;
    amount: number;
    accountId: string;
    toAccountId?: string | null;
    category: string;
    date: string;
    note?: string | null;
  }) => Transaction;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id" | "createdAt">>) => void;
  deleteTransaction: (id: string) => void;
  defaultAccountId: (prefer?: string | null) => string;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      accounts: seedAccounts(),
      transactions: [],

      addAccount: ({ name, type }) => {
        const acc: Account = {
          id: createId(),
          name: name.trim(),
          type,
          currentBalance: 0,
          color: DEFAULT_ACCOUNTS.find((d) => d.type === type)?.color ?? "#4A5560",
          archived: false,
          createdAt: new Date().toISOString(),
        };
        set({ accounts: [...get().accounts, acc] });
      },

      defaultAccountId: (prefer) => {
        const { accounts } = get();
        if (prefer && accounts.some((a) => a.id === prefer && !a.archived)) return prefer;
        return accounts.find((a) => !a.archived)?.id ?? accounts[0]!.id;
      },

      addTransaction: (input) => {
        const now = new Date().toISOString();
        const tx: Transaction = {
          id: createId(),
          type: input.type,
          title: input.title.trim() || "รายการ",
          amount: Math.abs(input.amount),
          accountId: input.accountId,
          toAccountId: input.type === "transfer" ? input.toAccountId : null,
          category: input.category,
          date: input.date,
          note: input.note ?? null,
          createdAt: now,
          updatedAt: now,
        };
        set({
          transactions: [tx, ...get().transactions],
          accounts: applyTx(get().accounts, tx, 1),
        });
        return tx;
      },

      updateTransaction: (id, patch) => {
        const prev = get().transactions.find((t) => t.id === id);
        if (!prev) return;
        let accounts = applyTx(get().accounts, prev, -1);
        const next: Transaction = {
          ...prev,
          ...patch,
          amount: patch.amount != null ? Math.abs(patch.amount) : prev.amount,
          updatedAt: new Date().toISOString(),
        };
        accounts = applyTx(accounts, next, 1);
        set({
          accounts,
          transactions: get().transactions.map((t) => (t.id === id ? next : t)),
        });
      },

      deleteTransaction: (id) => {
        const prev = get().transactions.find((t) => t.id === id);
        if (!prev) return;
        set({
          accounts: applyTx(get().accounts, prev, -1),
          transactions: get().transactions.filter((t) => t.id !== id),
        });
      },
    }),
    {
      name: "mydesk-finance-v1",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
    },
  ),
);

export function summarize(
  transactions: Transaction[],
  period: PeriodKey,
): { income: number; expense: number; net: number; list: Transaction[] } {
  const { from, to } = periodRange(period);
  const list = transactions.filter((t) => inRange(t.date, from, to));
  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense, list };
}

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  day: "วันนี้",
  week: "สัปดาห์นี้",
  month: "เดือนนี้",
  year: "ปีนี้",
};
