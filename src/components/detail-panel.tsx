/**
 * ชิ้นส่วนกลางของ “โหมดดูรายละเอียด” ที่ใช้ร่วมกันทุกหน้า
 *
 * เป้าหมาย: การ์ดที่กางดูรายละเอียดได้ (เป้าหมาย / บัญชี / ปฏิทิน) ใช้ภาษาเดียวกัน
 * ทั้งปุ่มกาง–พับ กล่องตัวเลขสรุป และกรอบรายการเดินบัญชี
 */
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
      <p className="text-[11px] leading-tight text-muted">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-sm font-semibold",
          tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DetailToggle({
  open,
  onToggle,
  controlsId,
  hint,
  label = "รายละเอียด",
  className,
}: {
  open: boolean;
  onToggle: () => void;
  controlsId: string;
  hint: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
      className={cn(
        "mt-3 flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
        {label}
      </span>
      <span className="tabular text-xs text-subtle">{hint}</span>
    </button>
  );
}

export function LedgerFrame({
  title,
  icon: Icon,
  countLabel,
  children,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  countLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
      <div className="flex items-center justify-between bg-surface-2/60 px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className="size-3.5 text-accent" strokeWidth={1.75} />
          {title}
        </p>
        <p className="tabular text-xs text-muted">{countLabel}</p>
      </div>
      {children}
      {footer}
    </div>
  );
}

export function LedgerRows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border/60">{children}</ul>;
}

export function LedgerEmpty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-xs text-muted">{children}</p>;
}

export function LedgerMoreButton({ expanded, hiddenCount, onToggle }: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full border-t border-border/60 bg-surface-2/40 px-3 py-2 text-xs font-medium text-accent hover:bg-surface-2"
    >
      {expanded ? "ย่อรายการ" : `ดูทั้งหมด ${hiddenCount} รายการ`}
    </button>
  );
}
