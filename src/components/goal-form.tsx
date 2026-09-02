import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOAL_TYPE_LABEL, GOAL_UNIT_OPTIONS, useGoalStore } from "@/lib/goals/store";
import type { Goal, GoalType } from "@/lib/goals/types";
import { todayISO } from "@/lib/utils";

const TYPES: Array<{ id: GoalType; label: string }> = [
  { id: "savings", label: "ออมเงิน" },
  { id: "habit", label: "นับวัน" },
  { id: "general", label: "ทั่วไป" },
];

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function GoalForm({
  initial,
  onClose,
}: {
  initial?: Goal | null;
  onClose: () => void;
}) {
  const addGoal = useGoalStore((s) => s.addGoal);
  const updateGoal = useGoalStore((s) => s.updateGoal);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<GoalType>(initial?.type ?? "savings");
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.targetAmount) : "");
  const [unit, setUnit] = useState(initial?.unit ?? "฿");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [duration, setDuration] = useState(() => {
    if (initial) {
      const s = new Date(initial.startDate);
      const e = new Date(initial.endDate);
      return String(Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
    }
    return "30";
  });
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("กรอกชื่อเป้าหมาย");
      return;
    }
    const target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("กรอกจำนวนเป้าหมายให้ถูกต้อง");
      return;
    }
    const days = Number(duration);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error("กรอกจำนวนวันให้ถูกต้อง");
      return;
    }
    const endDate = addDays(startDate, days - 1);

    if (initial) {
      updateGoal(initial.id, {
        title: title.trim(),
        type,
        targetAmount: target,
        unit,
        startDate,
        endDate,
        note: note.trim() || null,
      });
      toast.success("แก้ไขเป้าหมายแล้ว");
    } else {
      addGoal({
        title: title.trim(),
        type,
        targetAmount: target,
        unit,
        startDate,
        endDate,
        note: note.trim() || null,
      });
      toast.success("สร้างเป้าหมายแล้ว");
    }
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="goal-title">ชื่อเป้าหมาย</Label>
        <Input
          id="goal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น เก็บเงินซื้อของ"
          className="mt-1.5"
          required
        />
      </div>

      <div>
        <Label>ประเภท</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setType(t.id);
                if (t.id === "savings") setUnit("฿");
                else if (t.id === "habit") setUnit("ครั้ง");
                else setUnit("฿");
              }}
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="goal-target">เป้าหมาย</Label>
          <Input
            id="goal-target"
            inputMode="decimal"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="5000"
            className="mt-1.5 tabular"
            required
          />
        </div>
        <div>
          <Label htmlFor="goal-unit">หน่วย</Label>
          <select
            id="goal-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {GOAL_UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="goal-start">วันเริ่ม</Label>
          <Input
            id="goal-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="goal-duration">จำนวนวัน</Label>
          <Input
            id="goal-duration"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            className="mt-1.5 tabular"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="goal-note">หมายเหตุ</Label>
        <Input
          id="goal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit">{initial ? "บันทึกการแก้ไข" : "สร้างเป้าหมาย"}</Button>
      </div>
    </form>
  );
}
