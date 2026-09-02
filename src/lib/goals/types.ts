export type GoalType = "savings" | "habit" | "general";

export type GoalStatus = "active" | "completed" | "cancelled" | "expired";

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  targetAmount: number;
  unit: string; // "฿", "ครั้ง", "เล่ม", etc.
  startDate: string; // ISO date
  endDate: string; // ISO date
  status: GoalStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contribution {
  id: string;
  goalId: string;
  amount: number;
  date: string; // ISO date
  note: string | null;
  createdAt: string;
}
