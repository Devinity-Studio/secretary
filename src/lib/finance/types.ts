export type AccountType =
  | "cash"
  | "bank"
  | "credit"
  | "savings"
  | "ewallet"
  | "other";

export type TransactionType = "income" | "expense" | "transfer";

export type PeriodKey = "day" | "week" | "month" | "year";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number;
  creditLimit?: number | null;
  color: string;
  archived: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  category: string;
  date: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType | "both";
}

export interface ParsedCapture {
  raw: string;
  type: TransactionType | "unknown";
  amount: number | null;
  title: string;
  category: string | null;
  accountHint: string | null;
  toAccountHint: string | null;
  date: string;
  confidence: "high" | "medium" | "low";
}

// ─── Quota / Usage Tracking ───────────────────────────────────────────────

export type QuotaPeriod = "day" | "month"
export const QUOTA_PERIODS: QuotaPeriod[] = ["day", "month"]

export interface QuotaLimit {
  period: QuotaPeriod;
  maxCostUsd: number;   // Daily or monthly budget cap in USD
  maxRequests: number;  // Optional request count cap
}

export interface QuotaUsage {
  period: QuotaPeriod;
  costUsd: number;           // Sum of cost_in_usd_ticks / 1e10 for this period
  requestCount: number;      // Number of API calls made
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  lastUpdated: string;       // ISO timestamp of last record
}

export interface QuotaRecord {
  id: string;
  model: string;             // e.g. "grok-4.6"
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;      // Usually 1 per API call
  timestamp: string;        // ISO timestamp
  purpose?: string;         // Optional: what this call was for
}
