import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Inbox, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContextCard } from "@/components/context-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  defaultOverviewQuery,
  overviewCounts,
  selectOverviewContexts,
  type OverviewLifecycleFilter,
} from "@/lib/context/overview";
import { useContextStore } from "@/lib/context/store";
import { LIFECYCLE_STATUS_LABELS, type SourceType } from "@/lib/context/types";

export const Route = createFileRoute("/context")({ component: ContextOverview });

const LIFECYCLE_TABS: Array<{ value: OverviewLifecycleFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "tentative", label: LIFECYCLE_STATUS_LABELS.tentative },
  { value: "confirmed", label: LIFECYCLE_STATUS_LABELS.confirmed },
  { value: "completed", label: LIFECYCLE_STATUS_LABELS.completed },
  { value: "cancelled", label: LIFECYCLE_STATUS_LABELS.cancelled },
];

const SOURCE_TABS: Array<{ value: SourceType | "all"; label: string }> = [
  { value: "all", label: "ทุกช่องทาง" },
  { value: "user", label: "พิมพ์" },
  { value: "voice", label: "เสียง" },
];

function ContextOverview() {
  const contextsRecord = useContextStore((s) => s.contexts);
  const evidence = useContextStore((s) => s.evidence);
  const transitionLifecycle = useContextStore((s) => s.transitionLifecycle);

  const [search, setSearch] = useState(defaultOverviewQuery.search);
  const [lifecycle, setLifecycle] = useState<OverviewLifecycleFilter>(
    defaultOverviewQuery.lifecycle,
  );
  const [source, setSource] = useState<SourceType | "all">(defaultOverviewQuery.source);

  const counts = useMemo(() => overviewCounts(contextsRecord), [contextsRecord]);
  const list = useMemo(
    () =>
      selectOverviewContexts(contextsRecord, evidence, {
        search,
        lifecycle,
        source,
        orderBy: "createdAt-desc",
      }),
    [contextsRecord, evidence, search, lifecycle, source],
  );

  function confirmContext(id: string) {
    const ok = transitionLifecycle(id, "confirmed");
    if (ok) {
      toast.success("ยืนยันบริบทแล้ว");
    } else {
      toast.error("ยืนยันไม่สำเร็จ — สถานะปัจจุบันเปลี่ยนไปแล้ว");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">บริบททั้งหมด</h1>
          <p className="mt-1 text-sm text-muted">
            ค้นหา กรอง และยืนยันบริบทที่เลขาเก็บไว้ — {counts.total} รายการ
          </p>
        </div>

        {/* ลิงก์เข้า prototype Context Card */}
        <Link
          to="/context-card-demo"
          className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-hero-accent/40 bg-hero-top/40 px-4 py-2.5 text-sm text-muted transition-colors hover:bg-hero-top/70"
        >
          <Sparkles className="size-4 text-hero-accent" />
          ลอง Context Card prototype — จับ → การ์ด → ปัดแก้ → บริบท
        </Link>

        {/* ช่องค้นหา */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาจากเนื้อหา ประเภท หรือแท็ก…"
            aria-label="ช่องค้นหาบริบท"
            className="pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="ล้างคำค้นหา"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {/* กรอง lifecycle */}
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 pb-1">
            {LIFECYCLE_TABS.map((tab) => {
              const count = tab.value === "all" ? counts.total : counts[tab.value];
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setLifecycle(tab.value)}
                  aria-pressed={lifecycle === tab.value}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                    lifecycle === tab.value
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "tabular text-xs",
                      lifecycle === tab.value ? "text-accent-foreground/80" : "text-subtle",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* กรองช่องทาง */}
        <div className="flex gap-2">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSource(tab.value)}
              aria-pressed={source === tab.value}
              className={cn(
                "h-8 rounded-full border px-3 text-xs transition-colors",
                source === tab.value
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* รายการบริบท */}
        {list.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center">
            <Inbox className="mx-auto size-6 text-subtle" />
            <p className="mt-2 text-sm text-muted">
              {counts.total === 0
                ? "ยังไม่มีบริบท — เพิ่มได้จากหน้า \"วันนี้\""
                : "ไม่มีบริบทที่ตรงกับตัวกรอง"}
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {list.map((context) => (
              <div key={context.id} className="relative">
                <ContextCard context={context} evidenceById={evidence} />
                {context.lifecycle === "tentative" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute right-3 top-3 h-8 gap-1.5 rounded-full px-3 text-xs"
                    onClick={() => confirmContext(context.id)}
                    aria-label={`ยืนยันบริบท ${context.id}`}
                  >
                    <CheckCircle2 className="size-3.5 text-income" />
                    ยืนยัน
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
