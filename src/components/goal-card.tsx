import { Check, MoreHorizontal, Pencil, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { GOAL_TYPE_LABEL, goalStatusText, useGoalStore } from "@/lib/goals/store";
import type { Goal } from "@/lib/goals/types";
import { cn, formatBaht } from "@/lib/utils";

export function GoalCard({
  goal,
  onEdit,
  onContribute,
}: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onContribute: (g: Goal) => void;
}) {
  const { current, percent, daysElapsed, daysTotal, daysLeft } = useGoalStore((s) => s.goalProgress(goal.id));
  const completeGoal = useGoalStore((s) => s.completeGoal);
  const deleteGoal = useGoalStore((s) => s.deleteGoal);
  const [menuOpen, setMenuOpen] = useState(false);

  const isSavings = goal.type === "savings";
  const isComplete = goal.status === "completed";
  const isExpired = goal.status === "expired";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-surface p-4 md:p-5",
        isComplete ? "border-income/30 bg-income/5" : isExpired ? "border-expense/20 opacity-70" : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              isComplete ? "bg-income/10 text-income" : "bg-accent/10 text-accent",
            )}
          >
            <Target className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-medium">{goal.title}</p>
            <p className="text-xs text-muted">
              {GOAL_TYPE_LABEL[goal.type]} · {goalStatusText(goal.status)}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                <button
                  type="button"
                  onClick={() => { onEdit(goal); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface-2"
                >
                  <Pencil className="size-4" /> แก้ไข
                </button>
                {!isComplete && !isExpired && (
                  <button
                    type="button"
                    onClick={() => { completeGoal(goal.id); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-income hover:bg-surface-2"
                  >
                    <Check className="size-4" /> ทำสำเร็จ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { deleteGoal(goal.id); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-expense hover:bg-surface-2"
                >
                  <Trash2 className="size-4" /> ลบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="tabular text-2xl font-semibold">
            {isSavings ? formatBaht(current) : current}
            <span className="text-sm font-normal text-muted">
              {" / "}
              {isSavings ? formatBaht(goal.targetAmount) : goal.targetAmount}
              {goal.unit}
            </span>
          </p>
          <p className="tabular text-sm font-medium text-accent">{Math.round(percent)}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isComplete ? "bg-income" : "bg-accent",
            )}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>

      {/* Days */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          วันที่ {daysElapsed}/{daysTotal}
        </span>
        <span>
          {isComplete
            ? "🎉 สำเร็จ!"
            : isExpired
              ? "หมดเวลา"
              : daysLeft > 0
                ? `เหลือ ${daysLeft} วัน`
                : "วันสุดท้าย"}
        </span>
      </div>

      {/* Contribute button */}
      {!isComplete && !isExpired && (
        <button
          type="button"
          onClick={() => onContribute(goal)}
          className="mt-3 w-full rounded-xl border border-accent/20 bg-accent/5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
        >
          + เพิ่มยอดวันนี้
        </button>
      )}
    </div>
  );
}
