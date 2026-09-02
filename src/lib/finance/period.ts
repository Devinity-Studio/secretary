import type { PeriodKey } from "./types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function periodRange(period: PeriodKey, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (period === "day") {
    const iso = isoDate(now);
    return { from: iso, to: iso };
  }
  if (period === "week") {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: isoDate(start), to: isoDate(end) };
  }
  if (period === "month") {
    const from = `${y}-${pad(m + 1)}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    return { from, to: `${y}-${pad(m + 1)}-${pad(last)}` };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

export function parseRelativeDate(text: string, now = new Date()): string | null {
  if (/เมื่อวาน|เมื่อวาน/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return isoDate(d);
  }
  if (/พรุ่งนี้|พรุ้งนี้/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }
  if (/วันนี้/.test(text)) return isoDate(now);
  return null;
}
