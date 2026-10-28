/**
 * Calendar — Month history lib (UI-agnostic)
 *
 * ใช้โดยหน้าปฏิทินที่กางดูประวัติย้อนหลังของเดือน: รวมนัดหมาย + วันลา +
 * การบันทึกเป้าหมายของเดือนนั้นเป็นไทม์ไลน์เดียว (ใหม่สุดก่อน)
 * เป็น pure function ล้วน — รับข้อมูลเข้ามาแล้วคืนค่าที่คำนวณเสร็จ ไม่แตะ store
 */

import { EVENT_TYPE_LABEL, LEAVE_TYPE_LABEL } from "./types";
import type { CalendarEvent } from "./types";
import type { Contribution, Goal } from "@/lib/goals/types";

export interface MonthActivityEntry {
  id: string;
  kind: "event" | "goal";
  date: string;
  time: string | null;
  title: string;
  detail: string | null;
  /** ยอดที่บันทึก (เฉพาะรายการเป้าหมาย) */
  amount: number | null;
  unit: string | null;
  color: string;
}

export interface MonthActivity {
  entries: MonthActivityEntry[];
  eventCount: number;
  leaveCount: number;
  contributionCount: number;
  /** จำนวนวันในเดือนนั้นที่มีความเคลื่อนไหว */
  activeDays: number;
}

/** "2026-10" จากปี/เดือนแบบ 0-index */
export function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function compareEntries(a: MonthActivityEntry, b: MonthActivityEntry): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  // วันเดียวกัน: นัดหมายเรียงตามเวลาก่อน แล้วค่อยการบันทึกเป้าหมาย
  if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
  return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
}

export function buildMonthActivity(
  events: CalendarEvent[],
  goals: Goal[],
  contributions: Contribution[],
  year: number,
  month: number,
): MonthActivity {
  const prefix = monthPrefix(year, month);
  const monthEvents = events.filter((e) => e.date.startsWith(prefix));
  const monthContributions = contributions.filter((c) => c.date.startsWith(prefix));
  const goalById = new Map(goals.map((g) => [g.id, g]));

  const entries: MonthActivityEntry[] = [
    ...monthEvents.map((e) => ({
      id: `event:${e.id}`,
      kind: "event" as const,
      date: e.date,
      time: e.startTime,
      title: e.title,
      detail: e.leaveType
        ? `${EVENT_TYPE_LABEL[e.type]} · ${LEAVE_TYPE_LABEL[e.leaveType]}`
        : EVENT_TYPE_LABEL[e.type],
      amount: null,
      unit: null,
      color: e.color,
    })),
    ...monthContributions.map((c) => {
      const goal = goalById.get(c.goalId);
      return {
        id: `goal:${c.id}`,
        kind: "goal" as const,
        date: c.date,
        time: null,
        title: goal?.title ?? "เป้าหมาย",
        detail: c.note,
        amount: c.amount,
        unit: goal?.unit ?? null,
        color: "#0f766e",
      };
    }),
  ].sort(compareEntries);

  return {
    entries,
    eventCount: monthEvents.length,
    leaveCount: monthEvents.filter((e) => e.type === "leave").length,
    contributionCount: monthContributions.length,
    activeDays: new Set(entries.map((e) => e.date)).size,
  };
}
