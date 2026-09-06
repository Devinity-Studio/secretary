/**
 * Secretary Context — Zustand Store
 *
 * Manages the canonical Context state.
 *
 * Design principles:
 * - Context is the SOURCE OF TRUTH
 * - Evidence is IMMUTABLE and stored separately
 * - Facts trace to Evidence (provenance)
 * - Inferences trace to Evidence/Facts (provenance)
 * - Lifecycle ≠ Change History
 * - "Record First, Identify Later" — create with minimal data
 * - State transitions are explicit and validated
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId } from "@/lib/utils";
import type {
  SecretaryContext,
  CreateContextInput,
  Evidence,
  Fact,
  Inference,
  EntityLink,
  RelatedContext,
  ChangeEvent,
  SourceType,
  LifecycleStatus,
  ConfidenceLevel,
  EntityType,
  ContextRelationType,
  AddEvidenceInput,
  AddFactInput,
  AddInferenceInput,
  AddLinkInput,
  AddRelatedContextInput,
  ChangeEventType,
} from "./types";
import {
  canTransitionLifecycle,
  LIFECYCLE_STATUS_LABELS,
} from "./types";

const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

// ════════════════════════════════════════════════════════════════════════════════
// STATE INTERFACE
// ════════════════════════════════════════════════════════════════════════════════

interface ContextState {
  /** All contexts — keyed by ID */
  contexts: Record<string, SecretaryContext>;

  /** All evidence — keyed by ID (immutable) */
  evidence: Record<string, Evidence>;

  // ── Context CRUD ────────────────────────────────────────────────────────────

  /** Create a new Context (Record First, Identify Later) */
  createContext: (input: CreateContextInput) => SecretaryContext;

  /** Get a Context by ID */
  getContext: (id: string) => SecretaryContext | undefined;

  /** Get all contexts */
  getAllContexts: () => SecretaryContext[];

  /** Archive a Context (soft delete) */
  archiveContext: (id: string) => void;

  /** Delete a Context permanently */
  deleteContext: (id: string) => void;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Transition lifecycle status (validated) */
  transitionLifecycle: (id: string, newStatus: LifecycleStatus) => boolean;

  // ── Evidence ──────────────────────────────────────────────────────────────

  /** Add Evidence to a Context */
  addEvidence: (contextId: string, input: AddEvidenceInput) => void;

  /** Get Evidence by ID */
  getEvidence: (id: string) => Evidence | undefined;

  /** Get all Evidence for a Context */
  getEvidenceForContext: (contextId: string) => Evidence[];

  // ── Facts ─────────────────────────────────────────────────────────────────

  /** Add a Fact to a Context (must have evidence backing) */
  addFact: (contextId: string, input: AddFactInput) => void;

  /** Remove a Fact */
  removeFact: (contextId: string, factId: string) => void;

  // ── Inferences ────────────────────────────────────────────────────────────

  /** Add an Inference to a Context (must trace to evidence/facts) */
  addInference: (contextId: string, input: AddInferenceInput) => void;

  /** Confirm an Inference (converts to Fact, removes inference) */
  confirmInference: (contextId: string, inferenceId: string) => void;

  /** Reject an Inference */
  rejectInference: (contextId: string, inferenceId: string) => void;

  // ── Entity Links ───────────────────────────────────────────────────────────

  /** Link an entity to a Context */
  addLink: (contextId: string, input: AddLinkInput) => void;

  /** Remove a link */
  removeLink: (contextId: string, linkId: string) => void;

  // ── Related Contexts ─────────────────────────────────────────────────────

  /** Add a related Context */
  addRelatedContext: (contextId: string, input: AddRelatedContextInput) => void;

  /** Remove a related Context */
  removeRelatedContext: (contextId: string, relatedContextId: string) => void;

  // ── Enrichment ─────────────────────────────────────────────────────────────

  /** Update Context type */
  setType: (contextId: string, type: string) => void;

  /** Update priority */
  setPriority: (contextId: string, priority: number) => void;

  /** Add tags */
  addTag: (contextId: string, tag: string) => void;

  /** Remove tag */
  removeTag: (contextId: string, tag: string) => void;

  // ── History ────────────────────────────────────────────────────────────────

  /** Get change history for a Context */
  getHistory: (contextId: string) => ChangeEvent[];

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Get contexts by lifecycle status */
  getByLifecycle: (status: LifecycleStatus) => SecretaryContext[];

  /** Get contexts by type */
  getByType: (type: string) => SecretaryContext[];

  /** Get contexts by source */
  getBySource: (source: SourceType) => SecretaryContext[];

  /** Get contexts linked to an entity */
  getByLinkedEntity: (entityId: string) => SecretaryContext[];

  /** Get active (non-archived) contexts */
  getActiveContexts: () => SecretaryContext[];

  /** Get pending (tentative) contexts */
  getPendingContexts: () => SecretaryContext[];

  // ── Hydration ─────────────────────────────────────────────────────────────

  /** Replace all data (for Supabase sync) */
  replaceAll: (contexts: SecretaryContext[], evidence: Evidence[]) => void;
}

// ════════════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════════

export const useContextStore = create<ContextState>()(
  persist(
    (set, get) => ({
      contexts: {},
      evidence: {},

      // ── Context CRUD ────────────────────────────────────────────────────────

      createContext: (input) => {
        const now = new Date().toISOString();
        const contextId = createId();
        const evidenceId = createId();

        // Create immutable evidence
        const evidence: Evidence = {
          ...input.evidence,
          id: evidenceId,
        };

        // Create change event for creation
        const creationEvent: ChangeEvent = {
          id: createId(),
          type: "created",
          description: "Context created",
          changedBy: "user",
          occurredAt: now,
        };

        const context: SecretaryContext = {
          id: contextId,
          type: input.type ?? "unknown",
          lifecycle: input.lifecycle ?? "tentative",
          evidenceIds: [evidenceId],
          facts: [],
          inferences: [],
          primarySource: input.source ?? evidence.sourceType,
          sources: [evidence.sourceType],
          links: [],
          relatedContexts: [],
          history: [creationEvent],
          createdAt: now,
          updatedAt: now,
          createdBy: "user",
          expiresAt: null,
          priority: 50,
          tags: input.tags ?? [],
          archived: false,
          sharedWithUserIds: null,
          canonicalId: null,
        };

        set((s) => ({
          contexts: { ...s.contexts, [contextId]: context },
          evidence: { ...s.evidence, [evidenceId]: evidence },
        }));

        return context;
      },

      getContext: (id) => get().contexts[id],

      getAllContexts: () => Object.values(get().contexts),

      archiveContext: (id) => {
        set((s) => {
          const existing = s.contexts[id];
          if (!existing) return s;

          const now = new Date().toISOString();
          const event: ChangeEvent = {
            id: createId(),
            type: "status_transition",
            description: "Context archived",
            changedBy: "user",
            occurredAt: now,
            fromStatus: existing.lifecycle,
            toStatus: existing.lifecycle,
          };

          return {
            contexts: {
              ...s.contexts,
              [id]: {
                ...existing,
                archived: true,
                updatedAt: now,
                history: [...existing.history, event],
              },
            },
          };
        });
      },

      deleteContext: (id) => {
        set((s) => {
          const { [id]: _, ...restContexts } = s.contexts;
          // Also remove associated evidence
          const context = s.contexts[id];
          const evidenceToRemove = context?.evidenceIds ?? [];
          const newEvidence = { ...s.evidence };
          evidenceToRemove.forEach((eid) => {
            delete newEvidence[eid];
          });
          return {
            contexts: restContexts,
            evidence: newEvidence,
          };
        });
      },

      // ── Lifecycle ──────────────────────────────────────────────────────────

      transitionLifecycle: (id, newLifecycle) => {
        const context = get().contexts[id];
        if (!context) return false;

        if (!canTransitionLifecycle(context.lifecycle, newLifecycle)) {
          return false;
        }

        const now = new Date().toISOString();
        const event: ChangeEvent = {
          id: createId(),
          type: "status_transition",
          description: `Lifecycle changed from ${LIFECYCLE_STATUS_LABELS[context.lifecycle]} to ${LIFECYCLE_STATUS_LABELS[newLifecycle]}`,
          changedBy: "user",
          occurredAt: now,
          fromStatus: context.lifecycle,
          toStatus: newLifecycle,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [id]: {
              ...context,
              lifecycle: newLifecycle,
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));

        return true;
      },

      // ── Evidence ──────────────────────────────────────────────────────────

      addEvidence: (contextId, input) => {
        const context = get().contexts[contextId];
        if (!context) return;

        const now = new Date().toISOString();
        const evidenceId = createId();

        const evidence: Evidence = {
          ...input.evidence,
          id: evidenceId,
        };

        const event: ChangeEvent = {
          id: createId(),
          type: "evidence_added",
          description: input.note ?? `Evidence added from ${evidence.sourceType}`,
          changedBy: "user",
          occurredAt: now,
          itemId: evidenceId,
          itemType: "evidence",
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              evidenceIds: [...context.evidenceIds, evidenceId],
              sources: context.sources.includes(evidence.sourceType)
                ? context.sources
                : [...context.sources, evidence.sourceType],
              updatedAt: now,
              history: [...context.history, event],
            },
          },
          evidence: { ...s.evidence, [evidenceId]: evidence },
        }));
      },

      getEvidence: (id) => get().evidence[id],

      getEvidenceForContext: (contextId) => {
        const context = get().contexts[contextId];
        if (!context) return [];
        return context.evidenceIds
          .map((eid) => get().evidence[eid])
          .filter((e): e is Evidence => e !== undefined);
      },

      // ── Facts ─────────────────────────────────────────────────────────────

      addFact: (contextId, input) => {
        const context = get().contexts[contextId];
        if (!context) return;

        // Validate that evidence exists
        const validEvidenceIds = input.evidenceIds.filter(
          (eid) => get().evidence[eid] !== undefined,
        );
        if (validEvidenceIds.length === 0) return;

        const now = new Date().toISOString();
        const factId = createId();

        const fact: Fact = {
          id: factId,
          evidenceIds: validEvidenceIds,
          field: input.field,
          value: input.value,
          establishedAt: now,
        };

        const event: ChangeEvent = {
          id: createId(),
          type: "fact_added",
          description: `Fact added: ${input.field}`,
          changedBy: "user",
          occurredAt: now,
          itemId: factId,
          itemType: "fact",
          field: input.field,
          newValue: input.value,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              facts: [...context.facts, fact],
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      removeFact: (contextId, factId) => {
        const context = get().contexts[contextId];
        if (!context) return;

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              facts: context.facts.filter((f) => f.id !== factId),
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      // ── Inferences ────────────────────────────────────────────────────────

      addInference: (contextId, input) => {
        const context = get().contexts[contextId];
        if (!context) return;

        const now = new Date().toISOString();
        const inferenceId = createId();

        const inference: Inference = {
          id: inferenceId,
          evidenceIds: input.evidenceIds,
          factIds: input.factIds,
          field: input.field,
          value: input.value,
          confidence: input.confidence,
          reasoning: input.reasoning,
          inferredAt: now,
          confirmable: input.confirmable ?? true,
          confirmed: false,
        };

        const event: ChangeEvent = {
          id: createId(),
          type: "inference_added",
          description: `Inference added: ${input.field} = ${String(input.value)}`,
          changedBy: "ai",
          occurredAt: now,
          itemId: inferenceId,
          itemType: "inference",
          field: input.field,
          newValue: input.value,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              inferences: [...context.inferences, inference],
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      confirmInference: (contextId, inferenceId) => {
        const context = get().contexts[contextId];
        if (!context) return;

        const inference = context.inferences.find((i) => i.id === inferenceId);
        if (!inference || !inference.confirmable) return;

        const now = new Date().toISOString();

        // Convert to fact
        const factId = createId();
        const fact: Fact = {
          id: factId,
          evidenceIds: inference.evidenceIds,
          field: inference.field,
          value: inference.value,
          establishedAt: now,
        };

        const confirmEvent: ChangeEvent = {
          id: createId(),
          type: "inference_confirmed",
          description: `Inference confirmed: ${inference.field} = ${String(inference.value)}`,
          changedBy: "user",
          occurredAt: now,
          itemId: inferenceId,
          itemType: "inference",
          field: inference.field,
          newValue: inference.value,
        };

        const factEvent: ChangeEvent = {
          id: createId(),
          type: "fact_added",
          description: `Fact added from confirmed inference: ${inference.field}`,
          changedBy: "user",
          occurredAt: now,
          itemId: factId,
          itemType: "fact",
          field: inference.field,
          newValue: inference.value,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              facts: [...context.facts, fact],
              inferences: context.inferences.filter((i) => i.id !== inferenceId),
              updatedAt: now,
              history: [...context.history, confirmEvent, factEvent],
            },
          },
        }));
      },

      rejectInference: (contextId, inferenceId) => {
        const context = get().contexts[contextId];
        if (!context) return;

        const inference = context.inferences.find((i) => i.id === inferenceId);
        if (!inference) return;

        const now = new Date().toISOString();
        const event: ChangeEvent = {
          id: createId(),
          type: "inference_rejected",
          description: `Inference rejected: ${inference.field}`,
          changedBy: "user",
          occurredAt: now,
          itemId: inferenceId,
          itemType: "inference",
          field: inference.field,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              inferences: context.inferences.filter((i) => i.id !== inferenceId),
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      // ── Entity Links ──────────────────────────────────────────────────────

      addLink: (contextId, input) => {
        const context = get().contexts[contextId];
        if (!context) return;

        // Check for duplicate
        if (context.links.some((l) => l.entityId === input.entityId)) return;

        const now = new Date().toISOString();
        const linkId = createId();

        const link: EntityLink = {
          id: linkId,
          entityType: input.entityType,
          entityId: input.entityId,
          label: input.label,
          relationship: input.relationship,
          source: input.source ?? "user",
          createdAt: now,
        };

        const event: ChangeEvent = {
          id: createId(),
          type: "link_added",
          description: `Linked ${input.entityType}: ${input.label}`,
          changedBy: input.source ?? "user",
          occurredAt: now,
          itemId: linkId,
          itemType: "link",
          field: "link",
          newValue: input.entityId,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              links: [...context.links, link],
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      removeLink: (contextId, linkId) => {
        const context = get().contexts[contextId];
        if (!context) return;

        const link = context.links.find((l) => l.id === linkId);
        if (!link) return;

        const now = new Date().toISOString();
        const event: ChangeEvent = {
          id: createId(),
          type: "link_removed",
          description: `Removed link: ${link.label}`,
          changedBy: "user",
          occurredAt: now,
          itemId: linkId,
          itemType: "link",
          field: "link",
          oldValue: link.entityId,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              links: context.links.filter((l) => l.id !== linkId),
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      // ── Related Contexts ──────────────────────────────────────────────────

      addRelatedContext: (contextId, input) => {
        const context = get().contexts[contextId];
        if (!context) return;

        // Check if relationship already exists
        if (context.relatedContexts.some((r) => r.relatedContextId === input.relatedContextId)) return;

        const now = new Date().toISOString();
        const relatedId = createId();

        const related: RelatedContext = {
          id: relatedId,
          relatedContextId: input.relatedContextId,
          relationType: input.relationType,
          description: input.description,
          source: input.source ?? "user",
          createdAt: now,
        };

        const event: ChangeEvent = {
          id: createId(),
          type: "enriched",
          description: `Related context added: ${input.description}`,
          changedBy: input.source ?? "user",
          occurredAt: now,
          enrichmentType: "related_context",
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              relatedContexts: [...context.relatedContexts, related],
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      removeRelatedContext: (contextId, relatedContextId) => {
        const context = get().contexts[contextId];
        if (!context) return;

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              relatedContexts: context.relatedContexts.filter(
                (r) => r.relatedContextId !== relatedContextId,
              ),
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      // ── Enrichment ────────────────────────────────────────────────────────

      setType: (contextId, type) => {
        const context = get().contexts[contextId];
        if (!context) return;

        const now = new Date().toISOString();
        const event: ChangeEvent = {
          id: createId(),
          type: "enriched",
          description: `Type set: ${type}`,
          changedBy: "user",
          occurredAt: now,
          field: "type",
          oldValue: context.type,
          newValue: type,
        };

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              type,
              updatedAt: now,
              history: [...context.history, event],
            },
          },
        }));
      },

      setPriority: (contextId, priority) => {
        const context = get().contexts[contextId];
        if (!context) return;

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              priority: Math.max(0, Math.min(100, priority)),
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      addTag: (contextId, tag) => {
        const context = get().contexts[contextId];
        if (!context || context.tags.includes(tag)) return;

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              tags: [...context.tags, tag],
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      removeTag: (contextId, tag) => {
        const context = get().contexts[contextId];
        if (!context) return;

        set((s) => ({
          contexts: {
            ...s.contexts,
            [contextId]: {
              ...context,
              tags: context.tags.filter((t) => t !== tag),
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      // ── History ────────────────────────────────────────────────────────────

      getHistory: (contextId) => {
        const context = get().contexts[contextId];
        return context?.history ?? [];
      },

      // ── Queries ────────────────────────────────────────────────────────────

      getByLifecycle: (status) =>
        Object.values(get().contexts).filter(
          (c) => !c.archived && c.lifecycle === status,
        ),

      getByType: (type) =>
        Object.values(get().contexts).filter((c) => !c.archived && c.type === type),

      getBySource: (source) =>
        Object.values(get().contexts).filter(
          (c) => !c.archived && c.sources.includes(source),
        ),

      getByLinkedEntity: (entityId) =>
        Object.values(get().contexts).filter(
          (c) => !c.archived && c.links.some((l) => l.entityId === entityId),
        ),

      getActiveContexts: () =>
        Object.values(get().contexts).filter(
          (c) =>
            !c.archived &&
            (c.expiresAt === null || c.expiresAt > new Date().toISOString()) &&
            c.lifecycle !== "cancelled" &&
            c.lifecycle !== "completed",
        ),

      getPendingContexts: () =>
        Object.values(get().contexts).filter(
          (c) => !c.archived && c.lifecycle === "tentative",
        ),

      // ── Hydration ──────────────────────────────────────────────────────────

      replaceAll: (contexts, evidence) => {
        const contextMap: Record<string, SecretaryContext> = {};
        const evidenceMap: Record<string, Evidence> = {};

        contexts.forEach((c) => {
          contextMap[c.id] = c;
        });

        evidence.forEach((e) => {
          evidenceMap[e.id] = e;
        });

        set({
          contexts: contextMap,
          evidence: evidenceMap,
        });
      },
    }),
    {
      name: "secretary-context-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : localStorage,
      ),
    },
  ),
);

// ════════════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

export const useContext = (id: string) => useContextStore((s) => s.contexts[id]);
export const useAllContexts = () => useContextStore((s) => s.getAllContexts());
export const useActiveContexts = () => useContextStore((s) => s.getActiveContexts());
export const usePendingContexts = () =>
  useContextStore((s) => s.getPendingContexts());
