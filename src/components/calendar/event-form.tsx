import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCalendarStore } from "@/lib/calendar/store";
import { EVENT_TYPE_LABEL, LEAVE_TYPE_LABEL } from "@/lib/calendar/types";
import type { CalendarEvent, EventType, LeaveType } from "@/lib/calendar/types";
import { todayISO } from "@/lib/utils";

const TYPES: Array<{ id: EventType; label: string }> = [
  { id: "appointment", label: "นัดหมาย" },
  { id: "leave", label: "วันลา" },
  { id: "reminder", label: "เตือนความจำ" },
  { id: "event", label: "อีเวนต์" },
];

const LEAVE_TYPES: Array<{ id: LeaveType; label: string }> = [
  { id: "sick", label: "ลาป่วย" },
  { id: "personal", label: "ลากิจ" },
  { id: "vacation", label: "ลาพักร้อน" },
];

export function EventForm({
  initial,
  defaultDate,
  onClose,
}: {
  initial?: CalendarEvent | null;
  defaultDate?: string;
  onClose: () => void;
}) {
  const addEvent = useCalendarStore((s) => s.addEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);

  const [type, setType] = useState<EventType>(initial?.type ?? "appointment");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayISO());
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [leaveType, setLeaveType] = useState<LeaveType | "">(initial?.leaveType ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("กรอกชื่อรายการ");
      return;
    }
    const payload = {
      type,
      title: title.trim(),
      date,
      startTime: allDay ? null : startTime || null,
      endTime: allDay ? null : endTime || null,
      allDay,
      leaveType: type === "leave" ? (leaveType as LeaveType) : null,
      note: note.trim() || null,
    };

    if (initial) {
      updateEvent(initial.id, payload);
      toast.success("แก้ไขแล้ว");
    } else {
      addEvent(payload);
      toast.success("เพิ่มนัดหมายแล้ว");
    }
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>ประเภท</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 sm:grid-cols-4">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={
                type === t.id
                  ? "h-10 rounded-lg bg-surface text-sm font-medium text-foreground shadow-sm"
                  : "h-10 rounded-lg text-sm text-muted"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="event-title">ชื่อรายการ</Label>
        <Input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "appointment"
              ? "นัดหมอฟัน"
              : type === "leave"
                ? "ลาพักร้อน"
                : type === "reminder"
                  ? "จ่ายค่าไฟ"
                  : "งานเลี้ยง"
          }
          className="mt-1.5"
          required
        />
      </div>

      <div>
        <Label htmlFor="event-date">วันที่</Label>
        <Input
          id="event-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5"
        />
      </div>

      {type === "leave" && (
        <div>
          <Label>ประเภทวันลา</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {LEAVE_TYPES.map((lt) => (
              <button
                key={lt.id}
                type="button"
                onClick={() => setLeaveType(lt.id)}
                className={
                  leaveType === lt.id
                    ? "h-10 rounded-lg bg-surface text-sm font-medium text-foreground shadow-sm"
                    : "h-10 rounded-lg text-sm text-muted"
                }
              >
                {lt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="size-4 rounded border-border accent-accent"
          />
          ทั้งวัน
        </label>
      </div>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="event-start">เวลาเริ่ม</Label>
            <Input
              id="event-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="event-end">เวลาจบ</Label>
            <Input
              id="event-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="event-note">หมายเหตุ</Label>
        <Input
          id="event-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit">{initial ? "บันทึกการแก้ไข" : "เพิ่มนัดหมาย"}</Button>
      </div>
    </form>
  );
}
