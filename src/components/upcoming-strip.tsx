import { CalendarDays } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCalendarStore } from "@/lib/calendar/store";
import { EVENT_TYPE_LABEL, LEAVE_TYPE_LABEL } from "@/lib/calendar/types";
import { todayISO } from "@/lib/utils";

/**
 * UpcomingStrip — เหตุการณ์ที่จะเกิดขึ้นเร็ว ๆ นี้ (เริ่มจากวันนี้)
 *
 * แสดงบน Home มือถือ เหนือแถบ capture — ผู้ใช้เห็น "สิ่งที่กำลังจะมาถึง"
 * ได้ทันทีโดยไม่ต้องเข้าหน้าปฏิทิน จำกัด 3 รายการให้พื้นที่การ์ดฮีโร่ยังเด่น
 */
const MAX_SHOW = 3;

function dateLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "วันนี้";
  // คำนวณวันพรุ่งนี้ตามเวลาท้องถิ่น — ห้ามใช้ toISOString (UTC) ไม่งั้นตกวันเพี้ยนตอนหัวค่ำ/เช้ามืด
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO =
    `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (iso === tomorrowISO) return "พรุ่งนี้";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

function timeLabel(startTime: string | null, allDay: boolean): string {
  if (allDay) return "ทั้งวัน";
  if (!startTime) return "";
  return startTime;
}

export function UpcomingStrip() {
  const events = useCalendarStore((s) => s.events);

  const upcoming = useMemo(() => {
    const today = todayISO();
    return [...events]
      .filter((e) => e.date >= today)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
      )
      .slice(0, MAX_SHOW);
  }, [events]);

  if (upcoming.length === 0) {
    return (
      <Link
        to="/calendar"
        className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface/60 px-4 py-2.5 text-xs text-muted"
      >
        <CalendarDays className="size-3.5 shrink-0 text-subtle" />
        ยังไม่มีนัดหมายข้างหน้า — เพิ่มได้ที่ปฏิทิน
      </Link>
    );
  }

  return (
    <div className="space-y-1.5">
      {upcoming.map((e) => (
        <Link
          key={e.id}
          to="/calendar"
          className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: e.color }}
            aria-hidden
          />
          <span className="font-medium text-foreground">{dateLabel(e.date)}</span>
          <span className="tabular">{timeLabel(e.startTime, e.allDay)}</span>
          <span className="truncate">{e.title}</span>
          <span className="ml-auto shrink-0 text-subtle">
            {e.type === "leave" && e.leaveType
              ? LEAVE_TYPE_LABEL[e.leaveType]
              : EVENT_TYPE_LABEL[e.type]}
          </span>
        </Link>
      ))}
    </div>
  );
}
