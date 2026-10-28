/**
 * Finance — Account ledger lib (UI-agnostic)
 *
 * ใช้โดยหน้าการเงินที่กางดูรายละเอียดของแต่ละบัญชี: ผลของรายการต่อยอดบัญชี,
 * ยอดยกมา/ยอดคงเหลือ, เงินเข้า–ออก และรายการเดินบัญชีของช่วงเวลาที่เลือก
 * เป็น pure function ล้วน — รับข้อมูลเข้ามาแล้วคืนค่าที่คำนวณเสร็จ ไม่แตะ store
 */

import { inRange, periodRange } from "./period";
import type { Account, PeriodKey, Transaction } from "./types";

/** รายการนี้เกี่ยวกับบัญชีนี้ไหม (เป็นต้นทางหรือปลายทาง) */
export function accountInvolves(tx: Transaction, accountId: string): boolean {
  return tx.accountId === accountId || tx.toAccountId === accountId;
}

/**
 * ผลของรายการต่อยอดของบัญชี (+ เข้า, − ออก) — สูตรเดียวกับ `applyTx` ใน store
 * บัตรเครดิตกลับเครื่องหมาย: รายจ่ายทำให้ยอดหนี้เพิ่ม
 */
export function accountEffect(tx: Transaction, account: Pick<Account, "id" | "type">): number {
  const credit = account.type === "credit";
  if (tx.type === "income") {
    return tx.accountId === account.id ? tx.amount : 0;
  }
  if (tx.type === "expense") {
    if (tx.accountId !== account.id) return 0;
    return credit ? tx.amount : -tx.amount;
  }
  if (tx.accountId === account.id) return -tx.amount;
  if (tx.toAccountId === account.id) return credit ? -tx.amount : tx.amount;
  return 0;
}

export interface AccountLedger {
  entries: Transaction[];
  count: number;
  /** รวมเงินเข้าในช่วง */
  inflow: number;
  /** รวมเงินออกในช่วง (ค่าบวก) */
  outflow: number;
  /** ผลสุทธิ = inflow − outflow */
  net: number;
  /** ยอดก่อนช่วงเวลาเริ่ม */
  openingBalance: number;
  /** ยอดปัจจุบันของบัญชี */
  closingBalance: number;
  lastEntryDate: string | null;
}

/** รายการของบัญชีเดียวในช่วงเวลาที่เลือก เรียงใหม่สุดก่อน */
export function accountTransactions(
  transactions: Transaction[],
  accountId: string,
  from?: string,
  to?: string,
): Transaction[] {
  return transactions
    .filter((t) => accountInvolves(t, accountId))
    .filter((t) => (from && to ? inRange(t.date, from, to) : true))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** สรุปรายการเดินบัญชีของบัญชีในหนึ่งช่วงเวลา (วัน/สัปดาห์/เดือน/ปี) */
export function buildAccountLedger(
  account: Account,
  transactions: Transaction[],
  period: PeriodKey,
  now = new Date(),
): AccountLedger {
  const { from, to } = periodRange(period, now);
  const entries = accountTransactions(transactions, account.id, from, to);

  let inflow = 0;
  let outflow = 0;
  for (const tx of entries) {
    const effect = accountEffect(tx, account);
    if (effect >= 0) inflow += effect;
    else outflow += -effect;
  }

  // ยอดยกมา = ยอดปัจจุบัน − ผลของทุกรายการตั้งแต่วันที่เริ่มช่วงเป็นต้นไป
  const afterStart = transactions
    .filter((t) => accountInvolves(t, account.id) && t.date >= from)
    .reduce((sum, tx) => sum + accountEffect(tx, account), 0);

  return {
    entries,
    count: entries.length,
    inflow,
    outflow,
    net: inflow - outflow,
    openingBalance: account.currentBalance - afterStart,
    closingBalance: account.currentBalance,
    lastEntryDate: entries.length > 0 ? entries[0].date : null,
  };
}
