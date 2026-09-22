import { Check, Layers, Mic, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const WORKFLOW_STEPS = [
  { key: "input", label: "อินพุต", icon: Mic },
  { key: "card", label: "การ์ด", icon: Layers },
  { key: "adjust", label: "ปัด / แก้", icon: MousePointer2 },
  { key: "context", label: "บริบท", icon: Check },
] as const;

export type WorkflowStepKey = (typeof WORKFLOW_STEPS)[number]["key"];

export function WorkflowStrip({
  current,
  onStepClick,
}: {
  current: WorkflowStepKey;
  onStepClick?: (key: WorkflowStepKey) => void;
}) {
  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.key === current);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <nav
      aria-label="ขั้นตอนการทำงานของ Context Card"
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-xl border border-dashed border-border bg-surface/70 px-3 py-2.5",
      )}
    >
      {WORKFLOW_STEPS.map((step, i) => {
        const Icon = step.icon;
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        const stateClass = isActive
          ? "border-accent bg-accent text-accent-foreground"
          : isDone
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border bg-surface text-muted";
        return (
          <div key={step.key} className="flex min-w-0 flex-1 items-center gap-1">
            {i > 0 ? (
              <span aria-hidden className="h-px w-2 shrink-0 bg-border md:w-3" />
            ) : null}
            <button
              type="button"
              onClick={() => onStepClick?.(step.key)}
              disabled={!onStepClick}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex min-h-8 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-xs transition-colors",
                stateClass,
                onStepClick && !isActive && "hover:opacity-90",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{step.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
