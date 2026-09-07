import { ArrowUpRight, Brain, CheckCircle2, FileText, Link2 } from "lucide-react";
import type { Evidence, RelatedContext, SecretaryContext } from "@/lib/context/types";
import { buildContextCardModel } from "@/lib/context/presentation";
import { cn } from "@/lib/utils";

type ContextCardProps = {
  context: SecretaryContext;
  evidenceById: Record<string, Evidence>;
  onRelatedContextClick?: (related: RelatedContext) => void;
  className?: string;
};

const sectionClass = "border-t border-border pt-3";

export function ContextCard({
  context,
  evidenceById,
  onRelatedContextClick,
  className,
}: ContextCardProps) {
  const model = buildContextCardModel(context, evidenceById);

  return (
    <article className={cn("rounded-lg border border-border bg-surface p-4 shadow-sm", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted">
            {model.type}
          </p>
          <p className="mt-1 text-xs text-subtle">{model.id}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
          {model.lifecycle.label}
        </span>
      </header>

      {model.statement ? (
        <p className="mt-4 text-base leading-6 text-foreground">{model.statement.text}</p>
      ) : (
        <p className="mt-4 text-sm italic text-muted">ยังไม่มี Statement จาก Fact</p>
      )}

      {model.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {model.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-2 px-2 py-1 text-xs text-muted">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <details open={model.evidence.length > 0} className={sectionClass}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-accent" />
            Evidence <span className="text-xs text-muted">{model.evidence.length}</span>
          </summary>
          <div className="mt-3 space-y-2">
            {model.evidence.map((item) => (
              <div key={item.id} className="rounded-md bg-surface-2 p-3 text-sm">
                <div className="flex justify-between gap-3 text-xs text-muted">
                  <span>{item.source}</span>
                  <span>{item.confidence}</span>
                </div>
                <p className="mt-1 leading-5">{item.preview}</p>
              </div>
            ))}
          </div>
        </details>

        <details className={sectionClass}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-income" />
            Facts <span className="text-xs text-muted">{model.facts.length}</span>
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {model.facts.map((fact) => (
              <li key={fact.id} className="flex justify-between gap-3">
                <span className="text-muted">{fact.field}</span>
                <span className="text-right">{String(fact.value)}</span>
              </li>
            ))}
          </ul>
        </details>

        <details className={sectionClass}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <Brain className="size-4 text-expense" />
            Inferences <span className="text-xs text-muted">{model.inferences.length}</span>
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            {model.inferences.map((inference) => (
              <div key={inference.id} className="rounded-md bg-surface-2 p-3">
                <p>{inference.field}: {String(inference.value)}</p>
                <p className="mt-1 text-xs text-muted">{inference.reasoning}</p>
              </div>
            ))}
          </div>
        </details>

        <details className={sectionClass}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <Link2 className="size-4 text-accent" />
            Related Contexts <span className="text-xs text-muted">{model.relatedContexts.length}</span>
          </summary>
          <div className="mt-3 space-y-2">
            {model.relatedContexts.map((related) => (
              <button
                key={related.id}
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-surface-2 px-3 text-left text-sm transition-colors hover:bg-surface-3"
                onClick={() => onRelatedContextClick?.(related)}
              >
                <span>
                  <span className="block font-medium">{related.relationType}</span>
                  <span className="block text-xs text-muted">{related.description}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </details>
      </div>
    </article>
  );
}