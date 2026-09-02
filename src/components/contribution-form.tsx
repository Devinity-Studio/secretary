import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoalStore } from "@/lib/goals/store";
import type { Goal } from "@/lib/goals/types";
import { todayISO } from "@/lib/utils";

export function ContributionForm({
  goal,
  date,
  onClose,
}: {
  goal: Goal;
  date?: string;
  onClose: () => void;
}) {
  const addContribution = useGoalStore((s) => s.addContribution);
  const contributions = useGoalStore((s) => s.contributions);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedDate, setSelectedDate] = useState(date ?? todayISO());

  // Check if there's already a contribution for this date
  const existing = contributions.find(
    (c) => c.goalId === goal.id && c.date === selectedDate,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("กรอกจำนวนให้ถูกต้อง");
      return;
    }
    addContribution({
      goalId: goal.id,
      amount: n,
      date: selectedDate,
      note: note.trim() || null,
    });
    toast.success(`บันทึก ${goal.unit} แล้ว`);
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-surface-2 p-3">
        <p className="text-sm font-medium">{goal.title}</p>
        <p className="text-xs text-muted">
          {existing ? `วันนี้บันทึกแล้ว ${existing.amount} ${goal.unit}` : "ยังไม่มีรายการวันนี้"}
        </p>
      </div>

      <div>
        <Label htmlFor="contrib-date">วันที่</Label>
        <Input
          id="contrib-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="contrib-amount">{goal.unit === "฿" ? "จำนวนเงิน" : `จำนวน (${goal.unit})`}</Label>
        <Input
          id="contrib-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1.5 tabular text-lg"
          required
        />
      </div>

      <div>
        <Label htmlFor="contrib-note">หมายเหตุ</Label>
        <Input
          id="contrib-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="บันทึกเพิ่มเติม"
          className="mt-1.5"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit">บันทึก</Button>
      </div>
    </form>
  );
}
