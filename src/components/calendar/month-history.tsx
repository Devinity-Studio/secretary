import { CalendarClock, History, Target } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DetailToggle,
  LedgerEmpty,
  LedgerFrame,
  LedgerMoreButton,
  LedgerRows,
  StatTile,
} from "@/components/detail-panel";
import { formatThaiDate } from "@/lib/finance/period";
import { buildMonthActivity } from "@/lib/calendar/history";
import { useCalendarStore } from "@/lib/calendar/store";
import { useGoalStore } from "@/lib/goals/store";
import { formatGoalAmount } from "@/lib/goals/statement";

const PREVIEW_COUNT = 6;

export function MonthHistory({
  year,
  month,
  onSelectDate,
}: {
  year: number;
  month: number;
  onSelectDate: (date: string) => void;
}) {
  const events = useCalendarStore((s) => s.events);
  const goals = useGoalStore((s) => s.goals);
  const contributions = useGoalStore((s) => s.contributions);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const activity = useMemo(
    () => buildMonthActivity(events, goals, contributions, year, month),
    [events, goals, contributions, year, month],
  );

  const detailId = `month-history-${year}-${month}`;
  const visible = showAll ? activity.entries : activity.entries.slice(0, PREVIEW_COUNT);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <History className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">ประวัติย้อนหลัง</p>
          <p className="text-xs text-muted">นัดหมาย · วันลา · การบันทึกเป้าหมายของเดือนนี้</p>
        </div>
      </div>

      <DetailToggle
        open={open}
        onToggle={() => setOpen(!open)}
        controlsId={detailId}
        hint={
          activity.entries.length > 0
            ? `${activity.entries.length} รายการ · ${activity.activeDays} วัน`
            : "ยังไม่มีรายการในเดือนนี้"
        }
      />

      <div id={detailId}>
        {open && (
          <div className="mt-4 border-t border-border/70 pt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="นัดหมาย" value={`${activity.eventCount} รายการ`} />
              <StatTile label="วันลา" value={`${activity.leaveCount} วัน`} />
              <StatTile label="บันทึกเป้าหมาย" value={`${activity.contributionCount} ครั้ง`} />
              <StatTile label="วันที่มีความเคลื่อนไหว" value={`${activity.activeDays} วัน`} />
            </div>

            <LedgerFrame
              title="ไทม์ไลน์เดือนนี้"
              icon={CalendarClock}
              countLabel={`${activity.entries.length} รายการ`}
              footer={
                activity.entries.length > PREVIEW_COUNT ? (
                  <LedgerMoreButton
                    expanded={showAll}
                    hiddenCount={activity.entries.length}
                    onToggle={() => setShowAll(!showAll)}
                  />
                ) : undefined
              }
            >
              {activity.entries.length === 0 ? (
                <LedgerEmpty>ยังไม่มีรายการในเดือนนี้ — เริ่มจากเพิ่มนัดหมายหรือบันทึกเป้าหมาย</LedgerEmpty>
              ) : (
                <LedgerRows>
                  {visible.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onSelectDate(entry.date)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                      >
                        {entry.kind === "goal" ? (
                          <Target className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                        ) : (
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{entry.title}</p>
                          <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            <span>{formatThaiDate(entry.date)}</span>
                            {entry.time ? <span>{entry.time}</span> : null}
                            {entry.detail ? <span className="truncate">{entry.detail}</span> : null}
                          </p>
                        </div>
                        {entry.amount != null ? (
                          <p className="tabular shrink-0 text-sm font-semibold text-income">
                            +{entry.unit ? formatGoalAmount(entry.amount, entry.unit) : entry.amount}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </LedgerRows>
              )}
            </LedgerFrame>
          </div>
        )}
      </div>
    </div>
  );
}
