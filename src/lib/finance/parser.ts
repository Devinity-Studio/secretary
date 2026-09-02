import { CATEGORIES } from "./categories";
import { parseRelativeDate } from "./period";
import { todayISO } from "@/lib/utils";
import type { Account, ParsedCapture, TransactionType } from "./types";

const THAI_DIGITS: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

const INCOME_WORDS = [
  "เงินเดือน",
  "รายรับ",
  "ได้เงิน",
  "รับเงิน",
  "โบนัส",
  "ปันผล",
  "งานพิเศษ",
  "ค่าจ้าง",
  "freelance",
  "salary",
  "income",
];

const TRANSFER_WORDS = ["โอน", "ย้าย", "ออมเข้า", "โอนออม", "transfer"];

const CATEGORY_HINTS: Array<{ id: string; keys: string[] }> = [
  { id: "food", keys: ["กาแฟ", "ข้าว", "อาหาร", "กิน", "ร้าน", "ชา", "น้ำ", "ขนม", "มื้อ", "lunch", "coffee"] },
  { id: "transport", keys: ["แท็กซี่", "grab", "bts", "มอร์เตอร์", "น้ำมัน", "เดินทาง", "รถ", "taxi"] },
  { id: "utilities", keys: ["ค่าไฟ", "ค่าน้ำ", "ค่าเช่า", "เน็ตบ้าน", "สาธารณูปโภค"] },
  { id: "phone", keys: ["โทรศัพท์", "ค่าเน็ต", "ais", "true", "dtac"] },
  { id: "shopping", keys: ["ช้อป", "ซื้อของ", "เสื้อผ้า", "laz", "shopping"] },
  { id: "credit_payment", keys: ["จ่ายบัตร", "ชำระบัตร", "บิลบัตร"] },
  { id: "health", keys: ["หมอ", "ยา", "โรงพยาบาล", "คลินิก", "ฟัน"] },
  { id: "gift", keys: ["ของขวัญ", "วันเกิด"] },
  { id: "entertainment", keys: ["หนัง", "เกม", "netflix", "เพลง"] },
  { id: "education", keys: ["เรียน", "คอร์ส", "หนังสือ"] },
  { id: "salary", keys: ["เงินเดือน"] },
  { id: "freelance", keys: ["งานพิเศษ", "ค่าจ้าง", "freelance"] },
  { id: "investment_return", keys: ["ปันผล", "ดอกเบี้ย", "กองทุน"] },
  { id: "savings", keys: ["ออม", "savings"] },
];

function normalize(raw: string): string {
  return raw
    .replace(/[๐-๙]/g, (c) => THAI_DIGITS[c] ?? c)
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(text: string): { amount: number | null; rest: string } {
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*(k|พัน)/i);
  if (kMatch) {
    const n = Number(kMatch[1]) * 1000;
    return { amount: n, rest: text.replace(kMatch[0], " ").replace(/\s+/g, " ").trim() };
  }
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return { amount: null, rest: text };
  return {
    amount: Number(match[1]),
    rest: text.replace(match[0], " ").replace(/\s+/g, " ").trim(),
  };
}

function detectType(text: string): TransactionType | "unknown" {
  const lower = text.toLowerCase();
  if (TRANSFER_WORDS.some((w) => lower.includes(w))) return "transfer";
  if (INCOME_WORDS.some((w) => lower.includes(w))) return "income";
  if (/\d/.test(text)) return "expense";
  return "unknown";
}

function detectCategory(text: string, type: TransactionType | "unknown"): string | null {
  const lower = text.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (hint.keys.some((k) => lower.includes(k))) return hint.id;
  }
  if (type === "income") return "other_income";
  if (type === "transfer") return "transfer";
  if (type === "expense") return "other_expense";
  return null;
}

function matchAccount(text: string, accounts: Account[]): Account | null {
  const lower = text.toLowerCase();
  for (const a of accounts) {
    if (lower.includes(a.name.toLowerCase())) return a;
  }
  if (/เงินสด|สด|cash/.test(lower)) return accounts.find((a) => a.type === "cash") ?? null;
  if (/กสิกร|ธนาคาร|bank|scb|กสิ/.test(lower))
    return accounts.find((a) => a.type === "bank") ?? null;
  if (/บัตร|เครดิต|credit/.test(lower)) return accounts.find((a) => a.type === "credit") ?? null;
  if (/true|line pay|wallet|วอลเล็ต/.test(lower))
    return accounts.find((a) => a.type === "ewallet") ?? null;
  if (/ออม|savings|ครอบครัว/.test(lower))
    return accounts.find((a) => a.type === "savings") ?? null;
  return null;
}

export function parseCapture(raw: string, accounts: Account[]): ParsedCapture {
  const text = normalize(raw);
  const date = parseRelativeDate(text) ?? todayISO();
  const { amount, rest } = extractAmount(text);
  const type = detectType(text);
  const category = detectCategory(text, type);
  const matched = matchAccount(text, accounts);

  let accountHint: string | null = null;
  let toAccountHint: string | null = null;
  if (type === "transfer") {
    const savings = accounts.find((a) => a.type === "savings");
    const from =
      matched && matched.type !== "savings"
        ? matched
        : (accounts.find((a) => a.type === "bank") ?? accounts[0]);
    accountHint = from?.id ?? null;
    toAccountHint = savings?.id ?? matched?.id ?? null;
  } else {
    accountHint = matched?.id ?? null;
  }

  const titleFromRest = rest
    .replace(/วันนี้|พรุ่งนี้|เมื่อวาน|เมื่อวาน|บาท|฿/g, "")
    .replace(/โอนเข้า|โอนออม|ออมเข้า/g, "")
    .trim();

  const fallbackTitle =
    type === "income"
      ? CATEGORIES.find((c) => c.id === category)?.name ?? "รายรับ"
      : type === "transfer"
        ? "โอนเงิน"
        : titleFromRest || "รายจ่าย";

  const title = titleFromRest.length >= 1 && type !== "transfer" ? titleFromRest : fallbackTitle;

  const confidence: ParsedCapture["confidence"] =
    amount != null && type !== "unknown" ? "high" : amount != null ? "medium" : "low";

  return {
    raw,
    type,
    amount,
    title: title.slice(0, 80) || "รายการ",
    category,
    accountHint,
    toAccountHint,
    date,
    confidence,
  };
}
