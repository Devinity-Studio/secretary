export type EventType = "appointment" | "leave" | "reminder" | "event";

export type LeaveType = "sick" | "personal" | "vacation";

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string; // ISO date
  startTime: string | null; // HH:mm
  endTime: string | null; // HH:mm
  allDay: boolean;
  leaveType: LeaveType | null;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  appointment: "นัดหมาย",
  leave: "วันลา",
  reminder: "เตือนความจำ",
  event: "อีเวนต์",
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจ",
  vacation: "ลาพักร้อน",
};

export const EVENT_COLORS: Record<EventType, string> = {
  appointment: "#0f766e",
  leave: "#9a3b2f",
  reminder: "#b45309",
  event: "#4338ca",
};
