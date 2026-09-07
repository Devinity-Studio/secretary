import { useFinanceStore } from "@/lib/finance/store";
import type { QuotaPeriod, QuotaUsage } from "@/lib/finance/types";
import { useEffect, useState } from "react";

function formatCurrency(usd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(usd);
}

function QuotaBar({
  usage,
  limit,
  label,
}: {
  usage: number;
  limit: number;
  label: string;
}) {
  const pct = Math.min(100, (usage / limit) * 100);
  const color =
    pct >= 90
      ? "bg-danger"
      : pct >= 70
        ? "bg-accent"
        : "bg-subtle";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular font-medium">
          {usage.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function QuotaCard() {
  const [dayUsage, setDayUsage] = useState<QuotaUsage | null>(null);
  const [monthUsage, setMonthUsage] = useState<QuotaUsage | null>(null);
  const limits = useFinanceStore((s) => s.quotaLimits);
  const getUsage = useFinanceStore((s) => s.getQuotaUsage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDayUsage(getUsage("day"));
    setMonthUsage(getUsage("month"));
    setLoading(false);
  }, [getUsage]);

  const dayLimit = limits.find((l) => l.period === "day");
  const monthLimit = limits.find((l) => l.period === "month");

  if (loading) return null;

 return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">AI Usage</h3>
        <span className="text-xs text-muted">xAI / Grok API</span>
      </div>

      {/* Day usage */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">วันนี้</span>
          <span className="tabular font-medium">
            {dayUsage ? formatCurrency(dayUsage.costUsd) : "$0.0000"}
          </span>
        </div>
        {dayLimit && (
          <QuotaBar
            usage={Math.round(dayUsage?.costUsd ?? 0 * 10000) / 10000}
            limit={dayLimit.maxCostUsd}
            label={`งบวันนี้ (${formatCurrency(dayLimit.maxCostUsd)})`}
          />
        )}
      </div>

      {/* Month usage */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">เดือนนี้</span>
          <span className="tabular font-medium">
            {monthUsage ? formatCurrency(monthUsage.costUsd) : "$0.0000"}
          </span>
        </div>
        {monthLimit && (
          <QuotaBar
            usage={Math.round(monthUsage?.costUsd ?? 0 * 10000) / 10000}
            limit={monthLimit.maxCostUsd}
            label={`งบเดือน (${formatCurrency(monthLimit.maxCostUsd)})`}
          />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
        <div>
          <div className="text-xs text-muted">คำขอ</div>
          <div className="text-sm font-medium tabular">
            {dayUsage?.requestCount ?? 0}
            <span className="text-xs text-muted">/วัน</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">tokens</div>
          <div className="text-sm font-medium tabular">
            {(dayUsage?.tokenUsage.total ?? 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">models</div>
          <div className="text-sm font-medium tabular">
            {dayUsage && dayUsage.requestCount > 0 ? "กำลังใช้" : "—"}
          </div>
        </div>
      </div>

      {/* Warning */}
      {dayLimit && dayUsage && dayUsage.costUsd > dayLimit.maxCostUsd * 0.8 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          กำลังใกล้ถึงวงจรวันนี้ ชะลอการร้องขอหรือเพิ่มวงจรได้ที่ตั้งค่า
        </div>
      )}

      {dayLimit && dayUsage && dayUsage.costUsd >= dayLimit.maxCostUsd && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger font-medium">
          วงจรวันนี้หมดแล้ว โปรดรอจนถึงวันพรุ่งนี้
        </div>
      )}
    </div>
  );
}
