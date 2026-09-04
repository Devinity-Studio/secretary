import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId, todayISO } from "@/lib/utils";
import type { Contribution, Goal, GoalStatus, GoalType } from "./types";
import {
  pushGoal as syncPushGoal,
  deleteGoal as syncDeleteGoal,
  pushContribution as syncPushContribution,
  deleteContribution as syncDeleteContribution,
} from "@/lib/supabase/sync";

function computeStatus(goal: Goal, now: string): GoalStatus {
  if (goal.status === "completed" || goal.status === "cancelled") return goal.status;
  if (now > goal.endDate) return "expired";
  return "active";
}

interface GoalState {
  goals: Goal[];
  contributions: Contribution[];

  /** Replace all data from Supabase pull (hydrates on login). */
  replaceAll: (goals: Goal[], contributions: Contribution[]) => void;

  addGoal: (input: {
    title: string;
    type: GoalType;
    targetAmount: number;
    unit: string;
    startDate: string;
    endDate: string;
    note?: string | null;
  }) => Goal;

  updateGoal: (id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) => void;

  deleteGoal: (id: string) => void;

  completeGoal: (id: string) => void;

  addContribution: (input: {
    goalId: string;
    amount: number;
    date: string;
    note?: string | null;
  }) => Contribution;

  updateContribution: (id: string, patch: Partial<Omit<Contribution, "id" | "goalId" | "createdAt">>) => void;

  deleteContribution: (id: string) => void;

  goalProgress: (goalId: string) => { current: number; percent: number; daysElapsed: number; daysTotal: number; daysLeft: number };

  goalsForDate: (date: string) => Goal[];
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: [],
      contributions: [],

      replaceAll: (goals, contributions) => {
        set({ goals, contributions });
      },

      addGoal: (input) => {
        const now = new Date().toISOString();
        const goal: Goal = {
          id: createId(),
          title: input.title.trim(),
          type: input.type,
          targetAmount: Math.abs(input.targetAmount),
          unit: input.unit,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "active",
          note: input.note ?? null,
          createdAt: now,
          updatedAt: now,
        };
        set({ goals: [...get().goals, goal] });
        syncPushGoal(goal).catch(() => {});
        return goal;
      },

      updateGoal: (id, patch) => {
        const updated = get().goals.map((g) =>
          g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g,
        );
        set({ goals: updated });
        const row = updated.find((g) => g.id === id);
        if (row) syncPushGoal(row).catch(() => {});
      },

      deleteGoal: (id) => {
        set({
          goals: get().goals.filter((g) => g.id !== id),
          contributions: get().contributions.filter((c) => c.goalId !== id),
        });
        syncDeleteGoal(id).catch(() => {});
      },

      completeGoal: (id) => {
        const updated = get().goals.map((g) =>
          g.id === id ? { ...g, status: "completed" as GoalStatus, updatedAt: new Date().toISOString() } : g,
        );
        set({ goals: updated });
        const row = updated.find((g) => g.id === id);
        if (row) syncPushGoal(row).catch(() => {});
      },

      addContribution: (input) => {
        const now = new Date().toISOString();
        const c: Contribution = {
          id: createId(),
          goalId: input.goalId,
          amount: Math.abs(input.amount),
          date: input.date,
          note: input.note ?? null,
          createdAt: now,
        };
        set({ contributions: [...get().contributions, c] });
        syncPushContribution(c).catch(() => {});
        return c;
      },

      updateContribution: (id, patch) => {
        const updated = get().contributions.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        );
        set({ contributions: updated });
        const row = updated.find((c) => c.id === id);
        if (row) syncPushContribution(row).catch(() => {});
      },

      deleteContribution: (id) => {
        set({
          contributions: get().contributions.filter((c) => c.id !== id),
        });
        syncDeleteContribution(id).catch(() => {});
      },

      goalProgress: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal) return { current: 0, percent: 0, daysElapsed: 0, daysTotal: 0, daysLeft: 0 };

        const current = get().contributions
          .filter((c) => c.goalId === goalId)
          .reduce((sum, c) => sum + c.amount, 0);

        const percent = goal.targetAmount > 0 ? Math.min(100, (current / goal.targetAmount) * 100) : 0;

        const now = new Date();
        const start = new Date(goal.startDate);
        const end = new Date(goal.endDate);
        const msPerDay = 86400000;
        const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
        const daysElapsed = Math.max(0, Math.min(daysTotal, Math.round((now.getTime() - start.getTime()) / msPerDay) + 1));
        const daysLeft = Math.max(0, daysTotal - daysElapsed);

        return { current, percent, daysElapsed, daysTotal, daysLeft };
      },

      goalsForDate: (date) => {
        return get().goals.filter((g) => {
          const status = computeStatus(g, todayISO());
          return status === "active" && date >= g.startDate && date <= g.endDate;
        });
      },
    }),
    {
      name: "mydesk-goals-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 }
          : localStorage,
      ),
    },
  ),
);

export function goalStatusText(status: GoalStatus): string {
  switch (status) {
    case "active": return "กำลังทำ";
    case "completed": return "สำเร็จแล้ว";
    case "cancelled": return "ยกเลิก";
    case "expired": return "หมดเวลา";
  }
}

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  savings: "ออมเงิน",
  habit: "นับวัน",
  general: "ทั่วไป",
};

export const GOAL_UNIT_OPTIONS = ["฿", "ครั้ง", "เล่ม", "กิโล", "ชั่วโมง", "นาที"];
