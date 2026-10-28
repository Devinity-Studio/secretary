/**
 * Goals — Statement lib (UI-agnostic)
 *
 * ใช้โดยการ์ดเป้าหมายที่กางดูรายละเอียดได้: รวมยอด + สรุปความคืบหน้า + เรียงรายการเดินบัญชี
 * เป็น pure function ล้วน — รับ goal + contributions เข้ามาแล้วคืนค่าที่คำนวณเสร็จ ไม่แตะ store
 */

import type { Contribution, Goal } from "./types";

const MS_PER_DAY = 86400000;

export interface GoalDayCounts {
  daysTotal: number;
  daysElapsed: number;
  daysLeft: number;
}

/**
 * นับวันของเป้าหมายแบบเดียวกับ `goalProgress` ใน store (ใช้สูตรเดิมเป๊ะ
 * เพื่อให้ตัวเลขบนการ์ดกับในรายละเอียดไม่มีทางไม่ตรงกัน)
 */
export function goalDayCounts(goal: Goal, now = new Date()): GoalDayCounts {
  const start = new Date(goal.startDate);
  const end = new Date(goal.endDate);
  const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
  const daysElapsed = Math.max(
    0,
    Math.min(daysTotal, Math.round((now.getTime() - start.getTime()) / MS_PER_DAY) + 1),
  );
  const daysLeft = Math.max(0, daysTotal - daysElapsed);
  return { daysTotal, daysElapsed, daysLeft };
}

/**
 * ตัวเลขแสดงผลตามหน่วยของเป้าหมาย
 *
 * ค่าที่คำนวณได้ (เฉลี่ย/วัน, ต้องเก็บ/วัน) เป็นเศษทศนิยมยาว — ปัดเป็นจำนวนเต็ม
 * เมื่อค่าตั้งแต่ 10 ขึ้นไป แต่คงทศนิยมไว้ไม่เกิน 2 ตำแหน่งเมื่อค่าน้อยกว่านั้น
 * เพื่อไม่ให้เป้าเล็ก ๆ แสดงเป็น 0 ; `roundUp` ใช้กับ “ต้องเก็บ/วัน” ที่ต้องปัดขึ้น
 */
export function formatGoalAmount(
  amount: number,
  unit: string,
  opts?: { roundUp?: boolean },
): string {
  const value = opts?.roundUp ? Math.ceil(amount) : amount;
  const maximumFractionDigits = Number.isInteger(value) ? 0 : Math.abs(value) < 10 ? 2 : 0;
  const formatted = new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(value);
  return unit === "฿" ? `฿${formatted}` : `${formatted} ${unit}`;
}

export interface GoalStatement {
  /** รายการเดินบัญชีของเป้าหมายนี้ เรียงใหม่สุดก่อน */
  entries: Contribution[];
  total: number;
  remaining: number;
  count: number;
  /** จำนวนวันที่มีบันทึก (ไม่นับซ้ำวัน) */
  recordedDays: number;
  averagePerEntry: number;
  averagePerDay: number;
  /** ยอดที่ควรทำได้ ณ วันนี้ตามแผนเส้นตรง */
  expectedByNow: number;
  /** total − expectedByNow: บวก = เร็วกว่าแผน, ลบ = ช้ากว่าแผน */
  paceDiff: number;
  /** เปอร์เซ็นต์ของแผนที่ควรอยู่ ณ วันนี้ (สำหรับขีดบอกแผนบนแถบความคืบหน้า) */
  expectedPercent: number;
  /** ต้องเก็บอีกวันละเท่าไรเพื่อให้ทันวันสุดท้าย */
  perDayNeeded: number;
  daysTotal: number;
  daysElapsed: number;
  daysLeft: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

/** รายการของเป้าหมายเดียว เรียงตามวันที่ใหม่สุดก่อน (วันเท่ากันใช้เวลาสร้างใหม่สุดก่อน) */
export function goalContributions(
  contributions: Contribution[],
  goalId: string,
): Contribution[] {
  return contributions
    .filter((c) => c.goalId === goalId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
}

/** สรุปการเดินบัญชีทั้งชุดของเป้าหมายเดียว */
export function buildGoalStatement(
  goal: Goal,
  contributions: Contribution[],
  now = new Date(),
): GoalStatement {
  const entries = goalContributions(contributions, goal.id);
  const total = entries.reduce((sum, c) => sum + c.amount, 0);
  const remaining = Math.max(0, goal.targetAmount - total);
  const { daysTotal, daysElapsed, daysLeft } = goalDayCounts(goal, now);

  const expectation = goal.targetAmount * (daysElapsed / daysTotal);
  const expectedPercent =
    goal.targetAmount > 0 ? Math.max(0, Math.min(100, (expectation / goal.targetAmount) * 100)) : 0;

  return {
    entries,
    total,
    remaining,
    count: entries.length,
    recordedDays: new Set(entries.map((c) => c.date)).size,
    averagePerEntry: entries.length > 0 ? total / entries.length : 0,
    averagePerDay: daysElapsed > 0 ? total / daysElapsed : 0,
    expectedByNow: expectation,
    paceDiff: total - expectation,
    expectedPercent,
    perDayNeeded: remaining > 0 ? remaining / Math.max(1, daysLeft) : 0,
    daysTotal,
    daysElapsed,
    daysLeft,
    firstEntryDate: entries.length > 0 ? entries[entries.length - 1].date : null,
    lastEntryDate: entries.length > 0 ? entries[0].date : null,
  };
}
