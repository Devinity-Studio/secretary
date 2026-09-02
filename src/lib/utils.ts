import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(inputs.filter(Boolean).join(" "));
}

export function formatBaht(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: abs % 1 === 0 ? 0 : 2,
  }).format(abs);
  return amount < 0 ? `-฿${formatted}` : `฿${formatted}`;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
