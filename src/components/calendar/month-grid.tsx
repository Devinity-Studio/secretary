import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useGoalStore } from "@/lib/goals/store";
import { useCalendarStore } from "@/lib/calendar/store";
import { cn, todayISO } from "@/lib/utils";

const DAY_LABELS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  // Pad start with empty slots for Monday-start week
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, month, -startDay + i + 1);
    days.push(d);
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  // Pad end
  while (days.length % 7 !== 0) {
    const lastDay = days[days.length - 1];
    days.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1));
  }
  return days;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function MonthGrid({
  year,
  month,
  onPrev,
  onNext,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const events = useCalendarStore((s) => s.events);
  const goals = useGoalStore((s) => s.goals);
  const contributions = useGoalStore((s) => s.contributions);
  const today = todayISO();

  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  // Build lookup: which dates have events
  const eventMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      map[e.date] = (map[e.date] ?? 0) + 1;
    }
    return map;
  }, [events]);

  // Build lookup: which dates are in active goal ranges
  const goalDates = useMemo(() => {
    const set = new Set<string>();
    for (const g of goals) {
      if (g.status !== "active") continue;
      const start = new Date(g.startDate);
      const end = new Date(g.endDate);
      const d = new Date(start);
      while (d <= end) {
        set.add(isoDate(d));
        d.setDate(d.getDate() + 1);
      }
    }
    return set;
  }, [goals]);

  // Build lookup: contribution amounts per date
  const contribMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contributions) {
      map[c.date] = (map[c.date] ?? 0) + c.amount;
    }
    return map;
  }, [contributions]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-lg font-medium">
          {THAI_MONTHS[month]} {year + 543}
        </p>
        <button
          type="button"
          onClick={onNext}
          className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Day labels */}
      <div className="mt-3 grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1.5 text-center text-xs font-medium text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === month;
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const hasEvents = (eventMap[iso] ?? 0) > 0;
          const inGoalRange = goalDates.has(iso);
          const contribAmt = contribMap[iso];

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={cn(
                "relative flex h-11 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                !inMonth && "text-subtle/40",
                inMonth && "text-foreground",
                isToday && "font-bold",
                isSelected && "bg-accent text-accent-foreground",
                !isSelected && inGoalRange && "bg-accent/8",
                !isSelected && inMonth && !inGoalRange && "hover:bg-surface-2",
              )}
            >
              <span>{d.getDate()}</span>
              {/* Dots for events + contributions */}
              <div className="absolute bottom-0.5 flex gap-0.5">
                {hasEvents && (
                  <span className="size-1.5 rounded-full bg-[#4338ca]" />
                )}
                {contribAmt != null && contribAmt > 0 && (
                  <span className="size-1.5 rounded-full bg-accent" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
