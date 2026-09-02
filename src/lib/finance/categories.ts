import type { AccountType, Category } from "./types";

export const CATEGORIES: Category[] = [
  { id: "food", name: "อาหาร", type: "expense" },
  { id: "transport", name: "เดินทาง", type: "expense" },
  { id: "utilities", name: "สาธารณูปโภค", type: "expense" },
  { id: "phone", name: "โทรศัพท์/เน็ต", type: "expense" },
  { id: "shopping", name: "ช้อปปิ้ง", type: "expense" },
  { id: "credit_payment", name: "ชำระบัตรเครดิต", type: "expense" },
  { id: "health", name: "สุขภาพ", type: "expense" },
  { id: "gift", name: "ของขวัญ", type: "expense" },
  { id: "entertainment", name: "บันเทิง", type: "expense" },
  { id: "education", name: "การศึกษา", type: "expense" },
  { id: "other_expense", name: "อื่นๆ", type: "expense" },
  { id: "salary", name: "เงินเดือน", type: "income" },
  { id: "freelance", name: "งานพิเศษ", type: "income" },
  { id: "investment_return", name: "ผลตอบแทน", type: "income" },
  { id: "other_income", name: "รายรับอื่นๆ", type: "income" },
  { id: "transfer", name: "โอนเงิน", type: "transfer" },
  { id: "savings", name: "เงินออม", type: "transfer" },
];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  credit: "บัตรเครดิต",
  savings: "บัญชีออม",
  ewallet: "e-Wallet",
  other: "อื่นๆ",
};

export const DEFAULT_ACCOUNTS: Array<{
  name: string;
  type: AccountType;
  color: string;
}> = [
  { name: "เงินสด", type: "cash", color: "#3F5B4B" },
  { name: "บัญชีกสิกร", type: "bank", color: "#1D4E4A" },
  { name: "บัตรเครดิต", type: "credit", color: "#8A4B32" },
  { name: "TrueMoney", type: "ewallet", color: "#4A5560" },
  { name: "สะสมครอบครัว", type: "savings", color: "#2F4858" },
];

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}
