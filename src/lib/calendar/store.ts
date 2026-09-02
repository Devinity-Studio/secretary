import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId } from "@/lib/utils";
import type { CalendarEvent, EventType, LeaveType } from "./types";
import { EVENT_COLORS } from "./types";

interface CalendarState {
  events: CalendarEvent[];

  addEvent: (input: {
    type: EventType;
    title: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    allDay?: boolean;
    leaveType?: LeaveType | null;
    note?: string | null;
  }) => CalendarEvent;

  updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, "id" | "createdAt">>) => void;

  deleteEvent: (id: string) => void;

  eventsForDate: (date: string) => CalendarEvent[];

  eventsInRange: (from: string, to: string) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (input) => {
        const now = new Date().toISOString();
        const event: CalendarEvent = {
          id: createId(),
          type: input.type,
          title: input.title.trim(),
          date: input.date,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          allDay: input.allDay ?? false,
          leaveType: input.leaveType ?? null,
          note: input.note ?? null,
          color: EVENT_COLORS[input.type],
          createdAt: now,
          updatedAt: now,
        };
        set({ events: [...get().events, event] });
        return event;
      },

      updateEvent: (id, patch) => {
        set({
          events: get().events.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
          ),
        });
      },

      deleteEvent: (id) => {
        set({ events: get().events.filter((e) => e.id !== id) });
      },

      eventsForDate: (date) => {
        return get().events.filter((e) => e.date === date);
      },

      eventsInRange: (from, to) => {
        return get().events.filter((e) => e.date >= from && e.date <= to);
      },
    }),
    {
      name: "mydesk-calendar-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 }
          : localStorage,
      ),
    },
  ),
);
