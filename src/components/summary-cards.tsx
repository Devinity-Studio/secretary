import { formatBaht } from "@/lib/utils";

export function SummaryCards({
  income,
  expense,
  net,
}: {
  income: number;
  expense: number;
  net: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
        <p className="text-xs text-muted">รายรับ</p>
        <p className="mt-1 tabular text-base font-semibold text-income md:text-lg">{formatBaht(income)}</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
        <p className="text-xs text-muted">รายจ่าย</p>
        <p className="mt-1 tabular text-base font-semibold text-expense md:text-lg">{formatBaht(expense)}</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
        <p className="text-xs text-muted">สุทธิ</p>
        <p className={`mt-1 tabular text-base font-semibold md:text-lg ${net < 0 ? "text-expense" : "text-foreground"}`}>
          {formatBaht(net)}
        </p>
      </div>
    </div>
  );
}
