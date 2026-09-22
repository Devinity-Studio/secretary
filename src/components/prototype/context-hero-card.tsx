import { Paperclip } from "lucide-react";
import type { Evidence, SecretaryContext } from "@/lib/context/types";
import { SOURCE_TYPE_LABELS } from "@/lib/context/types";
import { buildContextCardModel } from "@/lib/context/presentation";
import { cn } from "@/lib/utils";

/** สีคลิปหนีบกระดาษของแต่ละ chip (วนตามลำดับ — แค่การตกแต่ง) */
const CLIP_COLORS = [
  "var(--color-clip-a)",
  "var(--color-clip-b)",
  "var(--color-clip-c)",
  "var(--color-clip-d)",
];

function relatedChipLabel(related: { description: string; relationType: string }): string {
  return related.description || related.relationType;
}

/** ตัดข้อความยาวให้เหลือ ~60 ตัวอักษรต่อ chip ในแถบใบเสร็จ */
function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function ContextHeroCard({
  context,
  evidenceById,
  onRelatedClick,
  className,
}: {
  context: SecretaryContext;
  evidenceById: Record<string, Evidence>;
  onRelatedClick?: (relatedContextId: string) => void;
  className?: string;
}) {
  const model = buildContextCardModel(context, evidenceById);

  // ข้อความหลักบนการ์ด: statement จาก Fact ถ้ามี ไม่งั้นใช้ข้อความ evidence ล่าสุด
  // (evidence immutable — ฉบับแก้ไขมาทีหลังจึงอยู่ท้ายและสะท้อนข้อความปัจจุบัน)
  const primaryText =
    model.statement?.text ??
    model.evidence[model.evidence.length - 1]?.preview ??
    "ยังไม่มีข้อความในบริบทนี้";

  const related = model.relatedContexts.slice(0, 4);
  const captureTime = new Date(model.createdAt).toLocaleTimeString("th-TH", {
    hour: "numeric",
    minute: "2-digit",
  });
  const captureDate = new Date(model.createdAt).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });

  return (
    <article
      className={cn(
        "hero-enter overflow-hidden rounded-xl border border-hero-accent/20 shadow-[0_10px_30px_-12px_rgba(38,32,28,0.25)]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(180deg, var(--color-hero-top) 0%, var(--color-hero-bottom) 100%)",
      }}
      aria-label={`บริบท: ${primaryText}`}
    >
      {/* แถวบน: ตราปั๊มเวลา + จุดเมนู */}
      <div className="flex items-start justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          {/* ตราเวลาที่จับได้ — เลียนแบบตราปั๊มบนการ์ดใน Guide */}
          <span
            className="rounded-lg border border-hero-accent/30 bg-surface/70 px-2.5 py-1 font-hand text-lg font-semibold text-hero-accent"
            aria-label={`จับได้เมื่อ ${captureDate} ${captureTime}`}
          >
            {captureTime}
          </span>
          <span className="font-hand text-base text-hero-ink/70">{captureDate}</span>
        </div>
        <span
          aria-hidden
          className="flex gap-1.5 py-2 text-hero-ink/50"
          role="presentation"
        >
          <span className="size-1.5 rounded-full bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
        </span>
      </div>

      {/* เนื้อหาหลัก: ข้อความที่จับได้ */}
      <div className="px-6 pb-6 pt-10 text-center">
        <p className="font-hand text-4xl font-semibold leading-snug text-hero-ink md:text-5xl">
          {primaryText}
        </p>
        {model.statement ? (
          <p className="mx-auto mt-3 max-w-sm text-sm leading-5 text-hero-ink/60">
            จาก {model.evidence.length} หลักฐาน · {SOURCE_TYPE_LABELS[context.primarySource]}
          </p>
        ) : null}
      </div>

      {/* แถว hashtag / mention จาก tags */}
      {model.tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
          {model.tags.map((tag) => (
            <span
              key={tag}
              className="font-hand text-lg font-medium text-hero-ink/80"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* แถบใบเสร็จ: บริบทที่เกี่ยวข้อง (คลิปหนีบกระดาษ) */}
      {related.length > 0 ? (
        <div
          className="receipt-strip flex items-stretch gap-0 overflow-x-auto px-2 py-2"
          aria-label={`บริบทที่เกี่ยวข้อง ${related.length} รายการ`}
        >
          {related.map((rel, i) => (
            <button
              key={rel.id}
              type="button"
              onClick={() => onRelatedClick?.(rel.relatedContextId)}
              className="group flex min-w-28 flex-1 flex-col items-center gap-1 px-2 py-1.5 text-center transition-opacity hover:opacity-80"
            >
              <Paperclip
                className="size-4 -scale-x-100 -rotate-45"
                style={{ color: CLIP_COLORS[i % CLIP_COLORS.length] }}
                aria-hidden
              />
              <span className="font-hand text-sm leading-tight text-hero-ink/80">
                {truncate(relatedChipLabel(rel))}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
