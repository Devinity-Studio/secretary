import { CalendarDays, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useCalendarStore } from "@/lib/calendar/store";
import { EVENT_TYPE_LABEL, LEAVE_TYPE_LABEL } from "@/lib/calendar/types";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useGoalStore } from "@/lib/goals/store";
import { todayISO } from "@/lib/utils";
import { formatThaiDate } from "@/lib/finance/period";

export function DayDetail({
  date,
  onAddEvent,
  onEditEvent,
  onAddContribution,
}: {
  date: string;
  onAddEvent: () => void;
  onEditEvent: (e: CalendarEvent) => void;
  onAddContribution: (goalId: string) => void;
}) {
  const allEvents = useCalendarStore((s) => s.events);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const allGoals = useGoalStore((s) => s.goals);
  const allContributions = useGoalStore((s) => s.contributions);

  const events = useMemo(() => allEvents.filter((e) => e.date === date), [allEvents, date]);
  const goals = useMemo(() => {
    const today = todayISO();
    return allGoals.filter((g) => {
      const isActive = g.status === "active" || (g.status !== "completed" && g.status !== "cancelled" && today <= g.endDate);
      return isActive && date >= g.startDate && date <= g.endDate;
    });
  }, [allGoals, date]);
  const dayContributions = useMemo(() => allContributions.filter((c) => c.date === date), [allContributions, date]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium">{formatThaiDate(date)}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onAddEvent}
            className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-3"
          >
            <Plus className="size-3.5" /> นัดหมาย
          </button>
        </div>
      </div>

      {/* Events */}
      {events.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
            >
              <div
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: e.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted">
                  {EVENT_TYPE_LABEL[e.type]}
                  {e.leaveType ? ` · ${LEAVE_TYPE_LABEL[e.leaveType]}` : ""}
                  {e.startTime ? ` · ${e.startTime}${e.endTime ? `–${e.endTime}` : ""}` : ""}
                </p>
              </div>
              <div className="flex shrink-0">
                <button
                  type="button"
                  onClick={() => onEditEvent(e)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteEvent(e.id)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-expense"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Goal contributions for this date */}
      {goals.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">เป้าหมายวันนี้</p>
          <div className="space-y-1.5">
            {goals.map((g) => {
              const contrib = dayContributions.find((c) => c.goalId === g.id);
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5"
                >
                  <Target className="size-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-muted">
                      {contrib ? `วันนี้ +${contrib.amount} ${g.unit}` : "ยังไม่บันทึก"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddContribution(g.id)}
                    className="flex items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent"
                  >
                    <Plus className="size-3" />
                    {contrib ? "เพิ่ม" : "บันทึก"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && goals.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <CalendarDays className="mx-auto size-8 text-subtle" />
          <p className="mt-2 text-sm text-muted">ไม่มีรายการในวันนี้</p>
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-2 text-sm text-accent underline-offset-4 hover:underline"
          >
            + เพิ่มนัดหมาย
          </button>
        </div>
      )}
    </div>
  );
}
