import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ContributionForm } from "@/components/contribution-form";
import { GoalCard } from "@/components/goal-card";
import { GoalForm } from "@/components/goal-form";
import { Modal } from "@/components/modal";
import { useGoalStore } from "@/lib/goals/store";
import type { Goal } from "@/lib/goals/types";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

function GoalsPage() {
  const goals = useGoalStore((s) => s.goals);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contribGoal, setContribGoal] = useState<Goal | null>(null);

  const activeGoals = goals.filter((g) => g.status === "active");
  const doneGoals = goals.filter((g) => g.status === "completed" || g.status === "expired" || g.status === "cancelled");

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">เป้าหมาย</h1>
            <p className="mt-1 text-sm text-muted">ตั้งเป้าหมายและติดตามความคืบหน้า</p>
          </div>
          <Button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="shrink-0"
          >
            <Plus className="size-4" />
            ใหม่
          </Button>
        </div>

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted">กำลังทำ</h2>
            {activeGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={(goal) => { setEditing(goal); setFormOpen(true); }}
                onContribute={(goal) => setContribGoal(goal)}
              />
            ))}
          </div>
        )}

        {/* Done goals */}
        {doneGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted">เสร็จแล้ว / หมดเวลา</h2>
            {doneGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={(goal) => { setEditing(goal); setFormOpen(true); }}
                onContribute={() => {}}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {goals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-16 text-center">
            <p className="text-lg">🎯</p>
            <p className="mt-2 text-sm text-muted">ยังไม่มีเป้าหมาย</p>
            <p className="mt-1 text-xs text-subtle">สร้างเป้าหมายแรกของคุณ เช่น "เก็บเงิน 5,000 ใน 30 วัน"</p>
            <Button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="mt-4"
            >
              <Plus className="size-4" />
              สร้างเป้าหมาย
            </Button>
          </div>
        )}
      </div>

      {/* Goal form modal */}
      <Modal
        title={editing ? "แก้ไขเป้าหมาย" : "สร้างเป้าหมาย"}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      >
        <GoalForm
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      </Modal>

      {/* Contribution modal */}
      <Modal
        title="เพิ่มยอด"
        open={!!contribGoal}
        onClose={() => setContribGoal(null)}
      >
        {contribGoal && (
          <ContributionForm
            goal={contribGoal}
            onClose={() => setContribGoal(null)}
          />
        )}
      </Modal>
    </AppShell>
  );
}
