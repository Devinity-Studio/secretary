import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { ContextCard } from "@/components/context-card";
import { useContextStore } from "@/lib/context/store";

/**
 * ContextFeed — แสดง Context ล่าสุดจาก store (local-first)
 *
 * - เรียงใหม่ → เก่า จำกัดตาม limit
 * - อ่านอย่างเดียว ไม่กระทบ Finance / Goals / Calendar
 * - ถ้ายังไม่มีบริบท แสดง empty state แนะนำการใช้งาน
 */
export function ContextFeed({ limit = 5 }: { limit?: number }) {
  // เลือก record ดิบที่ reference นิ่ง — ห้ามเรียก selector ที่สร้าง array ใหม่ทุกครั้ง
  // (getAllContexts() คืน Object.values ใหม่ตลอด → ทำ useSyncExternalStore loop)
  const contextsRecord = useContextStore((s) => s.contexts);
  const evidence = useContextStore((s) => s.evidence);

  const latest = useMemo(
    () =>
      Object.values(contextsRecord)
        .filter((c) => !c.archived)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    [contextsRecord, limit],
  );

  if (latest.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-5 text-center">
        <Sparkles className="mx-auto size-5 text-subtle" />
        <p className="mt-2 text-sm text-muted">
          ยังไม่มีบริบทที่บันทึกไว้
        </p>
        <p className="mt-1 text-xs text-subtle">
          พิมพ์หรือพูดด้านบน — เลขาจะเก็บเป็นบริบทแรกให้เอง
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {latest.map((context) => (
        <ContextCard
          key={context.id}
          context={context}
          evidenceById={evidence}
        />
      ))}
    </div>
  );
}
