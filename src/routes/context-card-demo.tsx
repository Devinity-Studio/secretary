import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Link2, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { WorkflowStrip, type WorkflowStepKey } from "@/components/prototype/workflow-strip";
import { ContextHeroCard } from "@/components/prototype/context-hero-card";
import { CardInputBar } from "@/components/prototype/card-input-bar";
import { Button } from "@/components/ui/button";
import { useContextStore } from "@/lib/context/store";
import { LIFECYCLE_STATUS_LABELS } from "@/lib/context/types";
import { createContextFromNote, shortContextRef } from "@/lib/context/note";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/context-card-demo")({
  component: ContextCardDemo,
});

const STEP_HINTS: Record<WorkflowStepKey, string> = {
  input: "พูดหรือพิมพ์สิ่งที่อยากจำ — เลขาเก็บเป็นบริบททันที",
  card: "การ์ดบริบทที่จับได้ — ตรวจก่อนว่าใช่ที่ตั้งใจ",
  adjust: "ปัดแก้ได้: แก้ข้อความ ใส่ #แท็ก หรือผูกกับบริบทอื่น",
  context: "สุดท้าย: ยืนยันให้เป็นบริบทที่เชื่อถือได้",
};

function ContextCardDemo() {
  const contextsRecord = useContextStore((s) => s.contexts);
  const evidence = useContextStore((s) => s.evidence);
  const transitionLifecycle = useContextStore((s) => s.transitionLifecycle);
  const addEvidence = useContextStore((s) => s.addEvidence);
  const addTag = useContextStore((s) => s.addTag);
  const addRelatedContext = useContextStore((s) => s.addRelatedContext);

  const [step, setStep] = useState<WorkflowStepKey>("input");
  const [latestId, setLatestId] = useState<string | null>(null);
  const [showType, setShowType] = useState(false);
  const [draft, setDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  const latest = latestId ? contextsRecord[latestId] : undefined;
  const otherContexts = useMemo(
    () =>
      Object.values(contextsRecord)
        .filter((c) => !c.archived && c.id !== latestId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [contextsRecord, latestId],
  );

  function goNext(next: WorkflowStepKey) {
    setStep(next);
  }

  function handleCaptured(contextId: string) {
    setLatestId(contextId);
    setShowType(false);
    goNext("card");
  }

  function saveAdjustment() {
    if (!latest) return;
    const text = draft.trim();
    if (text && text !== firstEvidenceText(latest.id)) {
      addEvidence(latest.id, {
        evidence: {
          sourceType: "user",
          sourceId: null,
          content: { kind: "text", text },
          capturedAt: new Date().toISOString(),
          confidence: "high",
        },
        note: "แก้ไขข้อความจากการ์ด",
      });
      toast.success("เพิ่มข้อความฉบับแก้ไขแล้ว — ของเดิมยังเก็บเป็นหลักฐาน");
    }
    setDraft("");
    goNext("context");
  }

  function addTagDraft() {
    const tag = tagDraft.trim().replace(/^#/, "");
    if (!tag || !latest) return;
    addTag(latest.id, tag);
    setTagDraft("");
  }

  function linkLatestOther() {
    if (!latest || otherContexts.length === 0) return;
    const other = otherContexts[0];
    const otherText = firstEvidenceText(other.id);
    addRelatedContext(latest.id, {
      relatedContextId: other.id,
      relationType: "related",
      description: otherText || "บริบทก่อนหน้า",
      source: "user",
    });
    toast.success("ผูกกับบริบทก่อนหน้าแล้ว");
  }

  function commitTyped() {
    const text = draft.trim();
    if (!text) return;
    const ctx = createContextFromNote({ text, origin: "text" });
    if (!ctx) return;
    setDraft("");
    handleCaptured(ctx.id);
  }

  function confirmLatest() {
    if (!latest) return;
    const ok = transitionLifecycle(latest.id, "confirmed");
    if (ok) {
      toast.success(`ยืนยันบริบทแล้ว ${shortContextRef(latest.id)}`);
    } else {
      toast.error("ยืนยันไม่สำเร็จ — สถานะปัจจุบันเปลี่ยนไปแล้ว");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Context Card</h1>
          <p className="mt-1 text-sm text-muted">
            Prototype ตาม UX Guide — จับ → การ์ด → ปัดแก้ → บริบท (ใช้ store จริงทุกจุด)
          </p>
        </div>

        <WorkflowStrip current={step} onStepClick={(key) => goNext(key)} />
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {STEP_HINTS[step]}
        </p>

        {/* ── Step: อินพุต ─────────────────────────────────────────── */}
        {step === "input" ? (
          <section className="space-y-8 rounded-xl border border-hero-accent/20 px-4 py-10"
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--color-hero-top) 0%, var(--color-hero-bottom) 100%)",
            }}
          >
            <p className="text-center font-hand text-2xl text-hero-ink/70">
              วันนี้มีอะไรจะให้จำไหม?
            </p>
            <CardInputBar
              onCaptured={handleCaptured}
              onKeyboard={() => setShowType((v) => !v)}
            />
            {showType ? (
              <div className="mx-auto flex w-full max-w-md gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) commitTyped();
                  }}
                  placeholder='พิมพ์เช่น "ซื้อกาแฟ 65 บาท"'
                  aria-label="ช่องพิมพ์บริบท"
                  className="min-h-11 flex-1 rounded-full border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
                />
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={!draft.trim()}
                  onClick={commitTyped}
                >
                  <Type className="size-4" />
                  บันทึก
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Step: การ์ด ──────────────────────────────────────────── */}
        {step === "card" ? (
          latest ? (
            <section className="space-y-4">
              <ContextHeroCard context={latest} evidenceById={evidence} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" onClick={() => goNext("adjust")}>
                  ปัด / แก้ก่อน
                  <ArrowRight className="size-4" />
                </Button>
                <Button type="button" onClick={() => goNext("context")}>
                  <CheckCircle2 className="size-4" />
                  ใช้ได้ ไปต่อ
                </Button>
              </div>
            </section>
          ) : (
            <EmptyCapture onGoInput={() => goNext("input")} />
          )
        ) : null}

        {/* ── Step: ปัด / แก้ ─────────────────────────────────────── */}
        {step === "adjust" ? (
          latest ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <label htmlFor="draft-text" className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  ข้อความ (แก้ได้ — ของเดิมเก็บเป็นหลักฐาน)
                </label>
                <textarea
                  id="draft-text"
                  value={draft || firstEvidenceText(latest.id)}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-hand text-xl text-hero-ink outline-none focus:border-accent"
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                    #แท็ก
                  </span>
                  {latest.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                      #{tag}
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTagDraft();
                    }}
                    placeholder="เพิ่มแท็ก…"
                    aria-label="เพิ่มแท็ก"
                    className="min-h-9 w-28 rounded-full border border-border bg-surface px-3 text-xs outline-none focus:border-accent"
                  />
                </div>

                {otherContexts.length > 0 && latest.relatedContexts.length === 0 ? (
                  <button
                    type="button"
                    onClick={linkLatestOther}
                    className="mt-4 flex min-h-11 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                  >
                    <Link2 className="size-4 text-accent" />
                    ผูกกับบริบทก่อนหน้า ({shortContextRef(otherContexts[0].id)})
                  </button>
                ) : null}
              </div>

              <ContextHeroCard context={latest} evidenceById={evidence} />

              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={saveAdjustment}>
                  <CheckCircle2 className="size-4" />
                  ได้แล้ว ไปยืนยัน
                </Button>
              </div>
            </section>
          ) : (
            <EmptyCapture onGoInput={() => goNext("input")} />
          )
        ) : null}

        {/* ── Step: บริบท (ยืนยัน) ────────────────────────────────── */}
        {step === "context" ? (
          latest ? (
            <section className="space-y-4">
              <ContextHeroCard
                context={latest}
                evidenceById={evidence}
                onRelatedClick={(id) => {
                  setLatestId(id);
                  goNext("card");
                }}
              />
              <div className="flex flex-col items-center gap-3">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs",
                    latest.lifecycle === "tentative"
                      ? "bg-surface-2 text-muted"
                      : "bg-accent/10 text-accent",
                  )}
                >
                  {LIFECYCLE_STATUS_LABELS[latest.lifecycle]}
                </span>
                {latest.lifecycle === "tentative" ? (
                  <Button type="button" onClick={confirmLatest}>
                    <CheckCircle2 className="size-4 text-income" />
                    ยืนยันบริบท
                  </Button>
                ) : (
                  <p className="text-sm text-muted">
                    บริบทนี้ยืนยันแล้ว — ดูทั้งหมดได้ที่{" "}
                    <Link to="/context" className="text-accent underline underline-offset-2">
                      หน้าบริบท
                    </Link>
                  </p>
                )}
              </div>
            </section>
          ) : (
            <EmptyCapture onGoInput={() => goNext("input")} />
          )
        ) : null}
      </div>
    </AppShell>
  );
}

function firstEvidenceText(contextId: string): string {
  const state = useContextStore.getState();
  const ctx = state.contexts[contextId];
  if (!ctx) return "";
  for (let i = ctx.evidenceIds.length - 1; i >= 0; i--) {
    const ev = state.evidence[ctx.evidenceIds[i]];
    if (ev && (ev.content.kind === "text" || ev.content.kind === "hybrid")) {
      return ev.content.text;
    }
  }
  return "";
}

function EmptyCapture({ onGoInput }: { onGoInput: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center">
      <Sparkles className="mx-auto size-6 text-subtle" />
      <p className="mt-2 text-sm text-muted">ยังไม่มีบริบทที่จับไว้ในเซสชันนี้</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onGoInput}>
        ไปจับบริบทแรก
      </Button>
    </section>
  );
}
