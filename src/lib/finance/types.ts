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
