import { PERIOD_LABEL } from "@/lib/finance/store";
import type { PeriodKey } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export function PeriodSwitch({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  const keys: PeriodKey[] = ["day", "week", "month", "year"];
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "h-10 rounded-lg text-sm font-medium",
            value === k ? "bg-surface text-foreground shadow-sm" : "text-muted",
          )}
        >
          {PERIOD_LABEL[k]}
        </button>
      ))}
    </div>
  );
}
