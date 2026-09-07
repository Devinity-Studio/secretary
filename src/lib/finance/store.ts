import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_ACCOUNTS } from "./categories";
import { inRange, periodRange } from "./period";
import type { Account, PeriodKey, Transaction, TransactionType, QuotaLimit, QuotaUsage, QuotaRecord, QuotaPeriod } from "./types";
import { createId } from "@/lib/utils";
import {
  pushAccount as syncPushAccount,
  pushTransaction as syncPushTransaction,
  deleteTransaction as syncDeleteTransaction,
} from "@/lib/supabase/sync";

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

  // Quota tracking
  quotaLimits: QuotaLimit[];
  quotaRecords: QuotaRecord[];

  /** Replace all data from Supabase pull (hydrates on login). */
  replaceAll: (accounts: Account[], transactions: Transaction[]) => void;

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

  // Quota methods
  addQuotaRecord: (record: Omit<QuotaRecord, "id" | "timestamp">) => void;
  getQuotaUsage: (period: QuotaPeriod) => QuotaUsage;
  setQuotaLimit: (period: QuotaPeriod, limit: Partial<QuotaLimit>) => void;
  resetQuotaPeriod: (period: QuotaPeriod) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      accounts: seedAccounts(),
      transactions: [],

      // Quota state
      quotaLimits: [
        { period: "day" as QuotaPeriod, maxCostUsd: 5, maxRequests: 50 },
        { period: "month" as QuotaPeriod, maxCostUsd: 50, maxRequests: 500 },
      ],
      quotaRecords: [],

      replaceAll: (accounts, transactions) => {
        set({ accounts, transactions });
      },

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
        syncPushAccount(acc).catch(() => {});
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
        syncPushTransaction(tx).catch(() => {});
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
        syncPushTransaction(next).catch(() => {});
      },

      deleteTransaction: (id) => {
        const prev = get().transactions.find((t) => t.id === id);
        if (!prev) return;
        set({
          accounts: applyTx(get().accounts, prev, -1),
          transactions: get().transactions.filter((t) => t.id !== id),
        });
        syncDeleteTransaction(id).catch(() => {});
      },

      // Quota methods
      addQuotaRecord: (record) => {
        const now = new Date().toISOString();
        const fullRecord: QuotaRecord = {
          ...record,
          id: createId(),
          timestamp: now,
        };
        set({ quotaRecords: [...get().quotaRecords, fullRecord] });
      },

      getQuotaUsage: (period: QuotaPeriod) => {
        const now = new Date();
        const records = get().quotaRecords;
        const filtered = records.filter((r) => {
          const d = new Date(r.timestamp);
          if (period === "day") {
            return d.toDateString() === now.toDateString();
          }
          // month
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });

        const costUsd = filtered.reduce((s, r) => s + r.costUsd, 0);
        const requestCount = filtered.reduce((s, r) => s + r.requestCount, 0);
        const tokenUsage = filtered.reduce(
          (s, r) => ({
            input: s.input + r.inputTokens,
            output: s.output + r.outputTokens,
            total: s.total + r.inputTokens + r.outputTokens,
          }),
          { input: 0, output: 0, total: 0 },
        );

        return {
          period,
          costUsd,
          requestCount,
          tokenUsage,
          lastUpdated: filtered.length > 0 ? filtered[filtered.length - 1].timestamp : now.toISOString(),
        };
      },

      setQuotaLimit: (period: QuotaPeriod, patch) => {
        set({
          quotaLimits: get().quotaLimits.map((l) =>
            l.period === period ? { ...l, ...patch } : l,
          ),
        });
      },

      resetQuotaPeriod: (period: QuotaPeriod) => {
        const now = new Date();
        const keepSuffix = period === "day"
          ? (r: QuotaRecord) => new Date(r.timestamp).toDateString() !== now.toDateString()
          : (r: QuotaRecord) =>
              new Date(r.timestamp).getMonth() !== now.getMonth() ||
              new Date(r.timestamp).getFullYear() !== now.getFullYear();
        set({
          quotaRecords: get().quotaRecords.filter(keepSuffix),
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
