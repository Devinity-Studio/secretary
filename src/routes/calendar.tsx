import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DayDetail } from "@/components/calendar/day-detail";
import { EventForm } from "@/components/calendar/event-form";
import { MonthGrid } from "@/components/calendar/month-grid";
import { ContributionForm } from "@/components/contribution-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { useGoalStore } from "@/lib/goals/store";
import { useCalendarStore } from "@/lib/calendar/store";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { Goal } from "@/lib/goals/types";
import { todayISO } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO());

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);

  const goals = useGoalStore((s) => s.goals);
  const contribGoal = goals.find((g) => g.id === contribGoalId) ?? null;

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else { setMonth(month + 1); }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">ปฏิทิน</h1>
            <p className="mt-1 text-sm text-muted">นัดหมาย · วันลา · เป้าหมาย</p>
          </div>
          <Button
            onClick={() => { setEditingEvent(null); setEventFormOpen(true); }}
            className="shrink-0"
          >
            <Plus className="size-4" />
            ใหม่
          </Button>
        </div>

        <MonthGrid
          year={year}
          month={month}
          onPrev={prevMonth}
          onNext={nextMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {selectedDate && (
          <DayDetail
            date={selectedDate}
            onAddEvent={() => { setEditingEvent(null); setEventFormOpen(true); }}
            onEditEvent={(e) => { setEditingEvent(e); setEventFormOpen(true); }}
            onAddContribution={(goalId) => setContribGoalId(goalId)}
          />
        )}
      </div>

      {/* Event form modal */}
      <Modal
        title={editingEvent ? "แก้ไขนัดหมาย" : "เพิ่มนัดหมาย"}
        open={eventFormOpen}
        onClose={() => { setEventFormOpen(false); setEditingEvent(null); }}
      >
        <EventForm
          initial={editingEvent}
          defaultDate={selectedDate ?? undefined}
          onClose={() => { setEventFormOpen(false); setEditingEvent(null); }}
        />
      </Modal>

      {/* Contribution modal */}
      <Modal
        title="เพิ่มยอดเป้าหมาย"
        open={!!contribGoal}
        onClose={() => setContribGoalId(null)}
      >
        {contribGoal && (
          <ContributionForm
            goal={contribGoal}
            date={selectedDate ?? undefined}
            onClose={() => setContribGoalId(null)}
          />
        )}
      </Modal>
    </AppShell>
  );
}
