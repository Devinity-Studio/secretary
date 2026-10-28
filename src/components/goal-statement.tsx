import { Pencil, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { LedgerEmpty, LedgerFrame, LedgerMoreButton, LedgerRows, StatTile } from "@/components/detail-panel";
import { formatThaiDate } from "@/lib/finance/period";
import { useGoalStore } from "@/lib/goals/store";
import {
  formatGoalAmount,
  type GoalStatement as GoalStatementData,
} from "@/lib/goals/statement";
import type { Contribution, Goal } from "@/lib/goals/types";
import { cn } from "@/lib/utils";

const PREVIEW_COUNT = 5;

export function GoalStatement({
  goal,
  statement,
  onEditEntry,
}: {
  goal: Goal;
  statement: GoalStatementData;
  onEditEntry?: (c: Contribution) => void;
}) {
  const deleteContribution = useGoalStore((s) => s.deleteContribution);
  const [showAll, setShowAll] = useState(false);

  const { entries, total, remaining, count, recordedDays, averagePerEntry, averagePerDay } =
    statement;
  const { daysElapsed, daysTotal } = statement;
  const visible = showAll ? entries : entries.slice(0, PREVIEW_COUNT);
  // ต่างจากแผนไม่ถึงครึ่งหน่วย = ถือว่าตามแผน
  const onPlan = Math.abs(statement.paceDiff) < 0.5;

  return (
    <div className="mt-4 border-t border-border/70 pt-4">
      {/* สรุปตัวเลขการเดินบัญชี */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="ยอดสะสม" value={formatGoalAmount(total, goal.unit)} />
        <StatTile
          label="คงเหลือ"
          value={remaining > 0 ? formatGoalAmount(remaining, goal.unit) : "ครบแล้ว"}
          tone={remaining > 0 ? undefined : "income"}
        />
        <StatTile label="บันทึก" value={`${count} ครั้ง`} />
        <StatTile label="เฉลี่ย/ครั้ง" value={formatGoalAmount(averagePerEntry, goal.unit)} />
        <StatTile label="เฉลี่ย/วัน" value={formatGoalAmount(averagePerDay, goal.unit)} />
        <StatTile
          label="ต้องเก็บ/วัน"
          value={
            statement.perDayNeeded > 0
              ? formatGoalAmount(statement.perDayNeeded, goal.unit, { roundUp: true })
              : "ครบแล้ว"
          }
        />
      </div>

      {/* เทียบกับแผน + วันที่บันทึก */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-muted">
          บันทึก {recordedDays}/{daysElapsed} วัน
          <span className="text-subtle"> · เหลืออีก {statement.daysLeft} วัน จาก {daysTotal} วัน</span>
        </span>
        <span
          className={cn(
            "font-medium",
            onPlan ? "text-muted" : statement.paceDiff > 0 ? "text-income" : "text-expense",
          )}
        >
          {onPlan ? "ตามแผน" : statement.paceDiff > 0 ? "เร็วกว่าแผน " : "ช้ากว่าแผน "}
          {onPlan ? "" : formatGoalAmount(Math.abs(statement.paceDiff), goal.unit)}
          <span className="ml-1 font-normal text-subtle">
            (แผน {formatGoalAmount(statement.expectedByNow, goal.unit)})
          </span>
        </span>
      </div>

      {/* รายการเดินบัญชี */}
      <LedgerFrame
        title="รายการเดินบัญชี"
        icon={ReceiptText}
        countLabel={`${count} รายการ`}
        footer={
          entries.length > PREVIEW_COUNT ? (
            <LedgerMoreButton
              expanded={showAll}
              hiddenCount={count}
              onToggle={() => setShowAll(!showAll)}
            />
          ) : undefined
        }
      >
        {entries.length === 0 ? (
          <LedgerEmpty>ยังไม่มีรายการ — กด “+ เพิ่มยอดวันนี้” เพื่อเริ่มบันทึก</LedgerEmpty>
        ) : (
          <LedgerRows>
            {visible.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="tabular text-sm">{formatThaiDate(c.date)}</p>
                  {c.note ? <p className="truncate text-xs text-muted">{c.note}</p> : null}
                </div>
                <p className="tabular shrink-0 text-sm font-semibold text-income">
                  +{formatGoalAmount(c.amount, goal.unit)}
                </p>
                <div className="flex shrink-0">
                  {onEditEntry ? (
                    <button
                      type="button"
                      aria-label="แก้ไขรายการ"
                      onClick={() => onEditEntry(c)}
                      className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="ลบรายการ"
                    onClick={() => deleteContribution(c.id)}
                    className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-expense"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </LedgerRows>
        )}
      </LedgerFrame>
    </div>
  );
}
