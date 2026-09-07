import type {
  Evidence,
  Fact,
  Inference,
  RelatedContext,
  SecretaryContext,
} from "./types";
import {
  CONFIDENCE_LABELS,
  LIFECYCLE_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
} from "./types";

export interface ContextCardEvidence {
  id: string;
  source: string;
  confidence: string;
  capturedAt: string;
  preview: string;
}

export interface ContextCardModel {
  id: string;
  type: string;
  lifecycle: { value: SecretaryContext["lifecycle"]; label: string };
  priority: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  statement: { text: string; basedOnFactIds: string[] } | null;
  evidence: ContextCardEvidence[];
  facts: Fact[];
  inferences: Inference[];
  relatedContexts: RelatedContext[];
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "ไม่ระบุ";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function evidencePreview(evidence: Evidence): string {
  if (evidence.content.kind === "text" || evidence.content.kind === "hybrid") {
    return evidence.content.text;
  }
  return Object.entries(evidence.content.data)
    .map(([key, value]) => `${key}: ${displayValue(value)}`)
    .join(" · ");
}

export function buildStatement(context: Pick<SecretaryContext, "facts">) {
  if (context.facts.length === 0) return null;

  return {
    text: context.facts
      .map((fact) => `${fact.field}: ${displayValue(fact.value)}`)
      .join(" · "),
    basedOnFactIds: context.facts.map((fact) => fact.id),
  };
}

export function buildContextCardModel(
  context: SecretaryContext,
  evidenceById: Record<string, Evidence>,
): ContextCardModel {
  return {
    id: context.id,
    type: context.type,
    lifecycle: {
      value: context.lifecycle,
      label: LIFECYCLE_STATUS_LABELS[context.lifecycle],
    },
    priority: context.priority,
    tags: [...context.tags],
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    statement: buildStatement(context),
    evidence: context.evidenceIds
      .map((evidenceId) => evidenceById[evidenceId])
      .filter((evidence): evidence is Evidence => Boolean(evidence))
      .map((evidence) => ({
        id: evidence.id,
        source: SOURCE_TYPE_LABELS[evidence.sourceType],
        confidence: CONFIDENCE_LABELS[evidence.confidence],
        capturedAt: evidence.capturedAt,
        preview: evidencePreview(evidence),
      })),
    facts: [...context.facts],
    inferences: [...context.inferences],
    relatedContexts: [...context.relatedContexts],
  };
}