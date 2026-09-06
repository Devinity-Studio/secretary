/**
 * Secretary Context — Domain Behavior Tests
 *
 * These tests verify DOMAIN BEHAVIOR, not just type compilation.
 *
 * Test categories:
 * 1. Create minimal Context (Record First)
 * 2. Add Evidence (immutable proof)
 * 3. Attach Fact to Evidence (provenance chain)
 * 4. Create Inference from Evidence/Facts (provenance chain)
 * 5. Lifecycle transitions (tentative → confirmed → completed/cancelled)
 * 6. Update Context while preserving history
 * 7. Multiple Evidence from multiple Sources → one Context
 * 8. Incomplete Context can exist
 * 9. Entity links can be added later
 * 10. Related Contexts for future S2S
 */

import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId } from "@/lib/utils";
import type {
  SecretaryContext,
  Evidence,
  Fact,
  Inference,
  EntityLink,
  RelatedContext,
  LifecycleStatus,
  SourceType,
  ConfidenceLevel,
  EntityType,
  CreateContextInput,
  AddFactInput,
  AddInferenceInput,
  AddLinkInput,
} from "./types";
import {
  canTransitionLifecycle,
  LIFECYCLE_TRANSITIONS,
  LIFECYCLE_STATUS_LABELS,
  CONTEXT_DOMAIN_TYPES,
} from "./types";

// ════════════════════════════════════════════════════════════════════════════════
// TEST STORE — Simplified context store for testing
// ════════════════════════════════════════════════════════════════════════════════

const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

function createTestStore() {
  return create<{
    contexts: Record<string, SecretaryContext>;
    evidence: Record<string, Evidence>;
    createContext: (input: CreateContextInput) => SecretaryContext;
    getContext: (id: string) => SecretaryContext | undefined;
    archiveContext: (id: string) => void;
    deleteContext: (id: string) => void;
    transitionLifecycle: (id: string, newLifecycle: LifecycleStatus) => boolean;
    addEvidence: (contextId: string, ev: Omit<Evidence, "id">) => void;
    getEvidence: (id: string) => Evidence | undefined;
    addFact: (contextId: string, input: AddFactInput) => void;
    addInference: (contextId: string, input: AddInferenceInput) => void;
    confirmInference: (contextId: string, inferenceId: string) => void;
    rejectInference: (contextId: string, inferenceId: string) => void;
    addLink: (contextId: string, input: AddLinkInput) => void;
    removeLink: (contextId: string, linkId: string) => void;
    addRelatedContext: (
      contextId: string,
      relatedId: string,
      relationType: string,
      description: string,
    ) => void;
    getHistory: (contextId: string) => any[];
    getByLinkedEntity: (entityId: string) => SecretaryContext[];
    getActiveContexts: () => SecretaryContext[];
    getPendingContexts: () => SecretaryContext[];
    replaceAll: (contexts: SecretaryContext[], evidence: Evidence[]) => void;
  }>()(
    persist(
      (set, get) => ({
        contexts: {},
        evidence: {},

        createContext: (input) => {
          const now = new Date().toISOString();
          const contextId = createId();
          const evidenceId = createId();

          const evidence: Evidence = {
            ...input.evidence,
            id: evidenceId,
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
            history: [
              {
                id: createId(),
                type: "created",
                description: "Context created",
                changedBy: "user",
                occurredAt: now,
              },
            ],
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

        archiveContext: (id) => {
          set((s) => {
            const existing = s.contexts[id];
            if (!existing) return s;
            return {
              contexts: {
                ...s.contexts,
                [id]: { ...existing, archived: true, updatedAt: new Date().toISOString() },
              },
            };
          });
        },

        deleteContext: (id) => {
          set((s) => {
            const { [id]: _, ...rest } = s.contexts;
            return { contexts: rest };
          });
        },

        transitionLifecycle: (id, newLifecycle) => {
          const context = get().contexts[id];
          if (!context) return false;
          if (!canTransitionLifecycle(context.lifecycle, newLifecycle)) return false;

          set((s) => ({
            contexts: {
              ...s.contexts,
              [id]: {
                ...context,
                lifecycle: newLifecycle,
                updatedAt: new Date().toISOString(),
                history: [
                  ...context.history,
                  {
                    id: createId(),
                    type: "status_transition",
                    description: `Lifecycle: ${context.lifecycle} → ${newLifecycle}`,
                    changedBy: "user",
                    occurredAt: new Date().toISOString(),
                    fromStatus: context.lifecycle,
                    toStatus: newLifecycle,
                  },
                ],
              },
            },
          }));
          return true;
        },

        addEvidence: (contextId, ev) => {
          const context = get().contexts[contextId];
          if (!context) return;

          const evidenceId = createId();
          const evidence: Evidence = { ...ev, id: evidenceId };

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                evidenceIds: [...context.evidenceIds, evidenceId],
                sources: context.sources.includes(evidence.sourceType)
                  ? context.sources
                  : [...context.sources, evidence.sourceType],
                updatedAt: new Date().toISOString(),
                history: [
                  ...context.history,
                  {
                    id: createId(),
                    type: "evidence_added",
                    description: `Evidence added from ${evidence.sourceType}`,
                    changedBy: "user",
                    occurredAt: new Date().toISOString(),
                    itemId: evidenceId,
                    itemType: "evidence",
                  },
                ],
              },
            },
            evidence: { ...s.evidence, [evidenceId]: evidence },
          }));
        },

        getEvidence: (id) => get().evidence[id],

        addFact: (contextId, input) => {
          const context = get().contexts[contextId];
          if (!context) return;

          const factId = createId();
          const fact: Fact = {
            id: factId,
            evidenceIds: input.evidenceIds,
            field: input.field,
            value: input.value,
            establishedAt: new Date().toISOString(),
          };

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                facts: [...context.facts, fact],
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        addInference: (contextId, input) => {
          const context = get().contexts[contextId];
          if (!context) return;

          const inferenceId = createId();
          const inference: Inference = {
            id: inferenceId,
            evidenceIds: input.evidenceIds,
            factIds: input.factIds,
            field: input.field,
            value: input.value,
            confidence: input.confidence,
            reasoning: input.reasoning,
            inferredAt: new Date().toISOString(),
            confirmable: input.confirmable ?? true,
            confirmed: false,
          };

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                inferences: [...context.inferences, inference],
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        confirmInference: (contextId, inferenceId) => {
          const context = get().contexts[contextId];
          if (!context) return;

          const inference = context.inferences.find((i) => i.id === inferenceId);
          if (!inference) return;

          const factId = createId();
          const fact: Fact = {
            id: factId,
            evidenceIds: inference.evidenceIds,
            field: inference.field,
            value: inference.value,
            establishedAt: new Date().toISOString(),
          };

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                facts: [...context.facts, fact],
                inferences: context.inferences.filter((i) => i.id !== inferenceId),
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        rejectInference: (contextId, inferenceId) => {
          const context = get().contexts[contextId];
          if (!context) return;

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                inferences: context.inferences.filter((i) => i.id !== inferenceId),
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        addLink: (contextId, input) => {
          const context = get().contexts[contextId];
          if (!context) return;
          if (context.links.some((l) => l.entityId === input.entityId)) return;

          const linkId = createId();
          const link: EntityLink = {
            id: linkId,
            entityType: input.entityType,
            entityId: input.entityId,
            label: input.label,
            relationship: input.relationship,
            source: input.source ?? "user",
            createdAt: new Date().toISOString(),
          };

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                links: [...context.links, link],
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        removeLink: (contextId, linkId) => {
          const context = get().contexts[contextId];
          if (!context) return;

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                links: context.links.filter((l) => l.id !== linkId),
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        addRelatedContext: (contextId, relatedId, relationType, description) => {
          const context = get().contexts[contextId];
          if (!context) return;

          const related: RelatedContext = {
            id: createId(),
            relatedContextId: relatedId,
            relationType: relationType as any,
            description,
            source: "user",
            createdAt: new Date().toISOString(),
          };

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                relatedContexts: [...context.relatedContexts, related],
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        getHistory: (contextId) => {
          return get().contexts[contextId]?.history ?? [];
        },

        getByLinkedEntity: (entityId) =>
          Object.values(get().contexts).filter((c) =>
            c.links.some((l) => l.entityId === entityId),
          ),

        getActiveContexts: () =>
          Object.values(get().contexts).filter((c) => !c.archived),

        getPendingContexts: () =>
          Object.values(get().contexts).filter(
            (c) => !c.archived && c.lifecycle === "tentative",
          ),

        replaceAll: (contexts, evidence) => {
          const cm: Record<string, SecretaryContext> = {};
          const em: Record<string, Evidence> = {};
          contexts.forEach((c) => { cm[c.id] = c; });
          evidence.forEach((e) => { em[e.id] = e; });
          set({ contexts: cm, evidence: em });
        },
      }),
      {
        name: "test-context",
        storage: createJSONStorage(() => memoryStorage),
      },
    ),
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TEST 1: Create Minimal Context (Record First, Identify Later)
// ════════════════════════════════════════════════════════════════════════════════

describe("1. Create Minimal Context", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("can create a Context with ONLY evidence (minimum required)", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "เงินเข้า 15000" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    expect(context).toBeDefined();
    expect(context.id).toBeDefined();
    expect(context.lifecycle).toBe("tentative");
    expect(context.facts).toEqual([]);
    expect(context.inferences).toEqual([]);
    expect(context.links).toEqual([]);
    expect(context.relatedContexts).toEqual([]);
    expect(context.tags).toEqual([]);
  });

  it("created Context has proper timestamps", () => {
    const before = new Date().toISOString();
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });
    const after = new Date().toISOString();

    expect(context.createdAt >= before).toBe(true);
    expect(context.createdAt <= after).toBe(true);
    expect(context.createdAt).toBe(context.updatedAt);
  });

  it("evidence is stored separately (immutable)", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "notification",
        sourceId: "bank-txn-123",
        content: { kind: "text", text: "เงินเข้า 15000" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const evidenceId = context.evidenceIds[0];
    const evidence = store.getState().getEvidence(evidenceId);

    expect(evidence).toBeDefined();
    expect(evidence?.sourceType).toBe("notification");
    expect(evidence?.sourceId).toBe("bank-txn-123");
  });

  it("incomplete Context can exist — no forced enrichment", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "external",
        sourceId: null,
        content: { kind: "text", text: "฿15000" },
        capturedAt: new Date().toISOString(),
        confidence: "medium",
      },
    });

    // Context exists with only evidence
    expect(context.facts.length).toBe(0);
    expect(context.links.length).toBe(0);
    expect(context.type).toBe("unknown"); // Not forced to have a type
  });

  it("can set initial type and tags if known", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: CONTEXT_DOMAIN_TYPES.FINANCIAL_TRANSACTION,
      tags: ["urgent", "review"],
    });

    expect(context.type).toBe("financial.transaction");
    expect(context.tags).toEqual(["urgent", "review"]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 2: Add Evidence (Multiple Sources Converge to One Context)
// ════════════════════════════════════════════════════════════════════════════════

describe("2. Add Evidence — Multiple Sources Converge", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("can add additional evidence to existing Context", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "email",
        sourceId: "email-1",
        content: { kind: "text", text: "Meeting tomorrow at 10" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: CONTEXT_DOMAIN_TYPES.CALENDAR_EVENT,
    });

    // Add evidence from different source
    store.getState().addEvidence(context.id, {
      sourceType: "notification",
      sourceId: "cal-reminder-1",
      content: { kind: "text", text: "Reminder: Meeting at 10" },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    const updated = store.getState().getContext(context.id)!;
    expect(updated.evidenceIds.length).toBe(2);
    expect(updated.sources).toContain("email");
    expect(updated.sources).toContain("notification");
  });

  it("multiple evidence from multiple sources map to one Context", () => {
    // Simulate: Email + LINE + Calendar → One Meeting Context
    const context = store.getState().createContext({
      evidence: {
        sourceType: "email",
        sourceId: "email-meeting",
        content: { kind: "text", text: "นัดประชุม 10:00" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: CONTEXT_DOMAIN_TYPES.CALENDAR_EVENT,
    });

    store.getState().addEvidence(context.id, {
      sourceType: "notification",
      sourceId: "line-message",
      content: { kind: "text", text: "เปลี่ยนเป็น 11 โมงนะครับ" },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    store.getState().addEvidence(context.id, {
      sourceType: "calendar",
      sourceId: "google-cal-event",
      content: { kind: "structured", data: { startTime: "11:00" } },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    const updated = store.getState().getContext(context.id)!;
    expect(updated.evidenceIds.length).toBe(3);
    expect(updated.sources).toContain("email");
    expect(updated.sources).toContain("notification");
    expect(updated.sources).toContain("calendar");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 3: Attach Fact to Evidence (Provenance Chain)
// ════════════════════════════════════════════════════════════════════════════════

describe("3. Attach Fact to Evidence — Provenance Chain", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("Fact must trace back to Evidence (provenance)", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "notification",
        sourceId: "bank-123",
        content: { kind: "text", text: "เงินเข้า ฿15000" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const evidenceId = context.evidenceIds[0];

    store.getState().addFact(context.id, {
      evidenceIds: [evidenceId],
      field: "amount",
      value: 15000,
    });

    const updated = store.getState().getContext(context.id)!;
    const fact = updated.facts[0];

    expect(fact).toBeDefined();
    expect(fact.evidenceIds).toContain(evidenceId);
    expect(fact.field).toBe("amount");
    expect(fact.value).toBe(15000);
  });

  it("Fact can have multiple evidence backing it", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "email",
        sourceId: "email-1",
        content: { kind: "text", text: "โอนเงิน 5000" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const emailEvidenceId = context.evidenceIds[0];

    store.getState().addEvidence(context.id, {
      sourceType: "notification",
      sourceId: "bank-2",
      content: { kind: "text", text: "ได้รับ 5000" },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    const bankEvidenceId = store.getState().getContext(context.id)!.evidenceIds[1];

    // Single fact backed by two evidence sources
    store.getState().addFact(context.id, {
      evidenceIds: [emailEvidenceId, bankEvidenceId],
      field: "amount",
      value: 5000,
    });

    const updated = store.getState().getContext(context.id)!;
    expect(updated.facts[0].evidenceIds).toContain(emailEvidenceId);
    expect(updated.facts[0].evidenceIds).toContain(bankEvidenceId);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 4: Create Inference from Evidence/Facts (Provenance Chain)
// ════════════════════════════════════════════════════════════════════════════════

describe("4. Create Inference — Must Trace to Evidence/Facts", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("Inference must trace back to Evidence and/or Facts", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "email",
        sourceId: "email-1",
        content: { kind: "text", text: "ขอโอนเงินให้คุณเอ" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const evidenceId = context.evidenceIds[0];

    // AI infers that คุณเอ is the recipient
    store.getState().addInference(context.id, {
      evidenceIds: [evidenceId],
      factIds: [],
      field: "recipient",
      value: "คุณเอ",
      confidence: "medium",
      reasoning: "Email mentions 'ให้คุณเอ' which indicates recipient",
    });

    const updated = store.getState().getContext(context.id)!;
    const inference = updated.inferences[0];

    expect(inference).toBeDefined();
    expect(inference.evidenceIds).toContain(evidenceId);
    expect(inference.factIds).toEqual([]);
    expect(inference.field).toBe("recipient");
    expect(inference.value).toBe("คุณเอ");
    expect(inference.confidence).toBe("medium");
    expect(inference.confirmable).toBe(true);
    expect(inference.confirmed).toBe(false);
  });

  it("Inference can be confirmed (converts to Fact)", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "email",
        sourceId: "email-1",
        content: { kind: "text", text: "ขอโอนเงินให้คุณเอ" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const evidenceId = context.evidenceIds[0];

    store.getState().addInference(context.id, {
      evidenceIds: [evidenceId],
      factIds: [],
      field: "recipient",
      value: "คุณเอ",
      confidence: "medium",
      reasoning: "Email mentions 'ให้คุณเอ'",
    });

    const inferenceId = store.getState().getContext(context.id)!.inferences[0].id;
    store.getState().confirmInference(context.id, inferenceId);

    const updated = store.getState().getContext(context.id)!;
    expect(updated.facts.length).toBe(1);
    expect(updated.inferences.length).toBe(0);
    expect(updated.facts[0].field).toBe("recipient");
    expect(updated.facts[0].value).toBe("คุณเอ");
  });

  it("Inference can be rejected", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().addInference(context.id, {
      evidenceIds: [],
      factIds: [],
      field: "category",
      value: "อาหาร",
      confidence: "low",
      reasoning: "AI guessed",
    });

    const inferenceId = store.getState().getContext(context.id)!.inferences[0].id;
    store.getState().rejectInference(context.id, inferenceId);

    const updated = store.getState().getContext(context.id)!;
    expect(updated.inferences.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 5: Lifecycle Transitions
// ════════════════════════════════════════════════════════════════════════════════

describe("5. Lifecycle Transitions", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("tentative → confirmed is valid", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });
    expect(context.lifecycle).toBe("tentative");

    const result = store.getState().transitionLifecycle(context.id, "confirmed");
    expect(result).toBe(true);
    expect(store.getState().getContext(context.id)!.lifecycle).toBe("confirmed");
  });

  it("tentative → cancelled is valid", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const result = store.getState().transitionLifecycle(context.id, "cancelled");
    expect(result).toBe(true);
    expect(store.getState().getContext(context.id)!.lifecycle).toBe("cancelled");
  });

  it("confirmed → completed is valid", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      lifecycle: "confirmed",
    });

    const result = store.getState().transitionLifecycle(context.id, "completed");
    expect(result).toBe(true);
    expect(store.getState().getContext(context.id)!.lifecycle).toBe("completed");
  });

  it("confirmed → cancelled is valid", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      lifecycle: "confirmed",
    });

    const result = store.getState().transitionLifecycle(context.id, "cancelled");
    expect(result).toBe(true);
    expect(store.getState().getContext(context.id)!.lifecycle).toBe("cancelled");
  });

  it("tentative → completed is INVALID (must confirm first)", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const result = store.getState().transitionLifecycle(context.id, "completed");
    expect(result).toBe(false);
    expect(store.getState().getContext(context.id)!.lifecycle).toBe("tentative");
  });

  it("cancelled is terminal — cannot transition", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().transitionLifecycle(context.id, "cancelled");
    expect(store.getState().transitionLifecycle(context.id, "confirmed")).toBe(false);
    expect(store.getState().transitionLifecycle(context.id, "completed")).toBe(false);
  });

  it("completed is terminal — cannot transition", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      lifecycle: "confirmed",
    });

    store.getState().transitionLifecycle(context.id, "completed");
    expect(store.getState().transitionLifecycle(context.id, "cancelled")).toBe(false);
    expect(store.getState().transitionLifecycle(context.id, "confirmed")).toBe(false);
  });

  it("all valid transitions match LIFECYCLE_TRANSITIONS definition", () => {
    const statuses: LifecycleStatus[] = ["tentative", "confirmed", "cancelled", "completed"];

    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransitionLifecycle(from, to)).toBe(
          LIFECYCLE_TRANSITIONS[from].includes(to),
        );
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 6: Update Context While Preserving History
// ════════════════════════════════════════════════════════════════════════════════

describe("6. Update Context — History Preserved", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("adding evidence creates history event", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().addEvidence(context.id, {
      sourceType: "email",
      sourceId: "email-1",
      content: { kind: "text", text: "more info" },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    const history = store.getState().getHistory(context.id);
    expect(history.length).toBe(2); // created + evidence_added
    expect(history[1].type).toBe("evidence_added");
  });

  it("lifecycle transition creates history event", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().transitionLifecycle(context.id, "confirmed");

    const history = store.getState().getHistory(context.id);
    const transitionEvent = history.find((h: any) => h.type === "status_transition");
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent.fromStatus).toBe("tentative");
    expect(transitionEvent.toStatus).toBe("confirmed");
  });

  it("history is append-only", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const initialHistoryLength = store.getState().getHistory(context.id).length;

    store.getState().addEvidence(context.id, {
      sourceType: "email",
      sourceId: null,
      content: { kind: "text", text: "test" },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    store.getState().transitionLifecycle(context.id, "confirmed");

    expect(store.getState().getHistory(context.id).length).toBeGreaterThan(initialHistoryLength);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 7: Entity Links Can Be Added Later (Record First)
// ════════════════════════════════════════════════════════════════════════════════

describe("7. Entity Links — Can Be Added Later", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("can add entity link after Context creation", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "เงินเข้า" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().addLink(context.id, {
      entityType: "account",
      entityId: "acc-kbank-001",
      label: "KBank บัญชีหลัก",
      relationship: "destination",
    });

    const updated = store.getState().getContext(context.id)!;
    expect(updated.links.length).toBe(1);
    expect(updated.links[0].entityType).toBe("account");
    expect(updated.links[0].label).toBe("KBank บัญชีหลัก");
  });

  it("can add multiple entity links of different types", () => {
    const context = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "โอนให้คุณเอซื้อของ" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().addLink(context.id, {
      entityType: "person",
      entityId: "person-ae",
      label: "คุณเอ",
      relationship: "recipient",
    });

    store.getState().addLink(context.id, {
      entityType: "project",
      entityId: "proj-office",
      label: "ออฟฟิศใหม่",
      relationship: "purpose",
    });

    const updated = store.getState().getContext(context.id)!;
    expect(updated.links.length).toBe(2);
    expect(updated.links.find((l) => l.entityType === "person")?.label).toBe("คุณเอ");
    expect(updated.links.find((l) => l.entityType === "project")?.label).toBe("ออฟฟิศใหม่");
  });

  it("can query contexts by linked entity", () => {
    const c1 = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "c1" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });
    const c2 = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "c2" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    store.getState().addLink(c1.id, { entityType: "person", entityId: "person-ae", label: "คุณเอ", relationship: "friend" });
    store.getState().addLink(c2.id, { entityType: "person", entityId: "person-ae", label: "คุณเอ", relationship: "friend" });

    const linked = store.getState().getByLinkedEntity("person-ae");
    expect(linked.length).toBe(2);
  });

  it("can remove entity link", () => {
    const context = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "test" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    store.getState().addLink(context.id, { entityType: "account", entityId: "acc-1", label: "Account", relationship: "source" });
    const linkId = store.getState().getContext(context.id)!.links[0].id;

    store.getState().removeLink(context.id, linkId);
    expect(store.getState().getContext(context.id)!.links.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 8: Related Contexts (Future S2S Support)
// ════════════════════════════════════════════════════════════════════════════════

describe("8. Related Contexts — Future S2S Ready", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("can link contexts to each other", () => {
    const c1 = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "c1" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });
    const c2 = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "c2" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    store.getState().addRelatedContext(c1.id, c2.id, "related", "Related to c2");

    const updated = store.getState().getContext(c1.id)!;
    expect(updated.relatedContexts.length).toBe(1);
    expect(updated.relatedContexts[0].relatedContextId).toBe(c2.id);
    expect(updated.relatedContexts[0].relationType).toBe("related");
  });

  it("context has sharedWithUserIds field for future S2S (null by default)", () => {
    const context = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "test" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    expect(context.sharedWithUserIds).toBeNull();
    expect(context.canonicalId).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 9: Archive and Delete
// ════════════════════════════════════════════════════════════════════════════════

describe("9. Archive and Delete", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("archiveContext sets archived flag", () => {
    const context = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "test" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    store.getState().archiveContext(context.id);
    expect(store.getState().getContext(context.id)!.archived).toBe(true);
  });

  it("archived context excluded from active queries", () => {
    const context = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "test" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    store.getState().archiveContext(context.id);
    const active = store.getState().getActiveContexts();
    expect(active.some((c) => c.id === context.id)).toBe(false);
  });

  it("deleteContext removes context permanently", () => {
    const context = store.getState().createContext({
      evidence: { sourceType: "user", sourceId: null, content: { kind: "text", text: "test" }, capturedAt: new Date().toISOString(), confidence: "high" },
    });

    store.getState().deleteContext(context.id);
    expect(store.getState().getContext(context.id)).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// TEST 10: Domain Types and Labels
// ════════════════════════════════════════════════════════════════════════════════

describe("10. Domain Types and Labels", () => {
  it("has all expected domain types", () => {
    expect(CONTEXT_DOMAIN_TYPES.FINANCIAL_TRANSACTION).toBe("financial.transaction");
    expect(CONTEXT_DOMAIN_TYPES.CALENDAR_EVENT).toBe("calendar.event");
    expect(CONTEXT_DOMAIN_TYPES.PERSON_CONTACT).toBe("person.contact");
  });

  it("has labels for all lifecycle statuses", () => {
    const statuses: LifecycleStatus[] = ["tentative", "confirmed", "cancelled", "completed"];
    for (const status of statuses) {
      expect(LIFECYCLE_STATUS_LABELS[status]).toBeDefined();
      expect(typeof LIFECYCLE_STATUS_LABELS[status]).toBe("string");
    }
  });
});
