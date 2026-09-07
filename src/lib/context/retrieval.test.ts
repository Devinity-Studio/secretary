/**
 * Secretary Context — Retrieval Layer Tests
 *
 * Test the retrieval contract: scoped, deterministic, boundary-preserving.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

function expect(actual: unknown): {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(expected: string): void;
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeDefined(): void;
  toBeNull(): void;
  toMatch(expected: RegExp): void;
  toBeUndefined(): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
} {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toContain(expected: string) {
      assert.ok(String(actual).includes(expected));
    },
    toBeGreaterThan(expected: number) {
      assert.ok(Number(actual) > expected);
    },
    toBeLessThan(expected: number) {
      assert.ok(Number(actual) < expected);
    },
    toBeDefined() {
      assert.ok(actual !== undefined && actual !== null);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    toMatch(expected: RegExp) {
      assert.ok(expected.test(String(actual)));
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined);
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok(Number(actual) >= expected);
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok(Number(actual) <= expected);
    },
  };
}

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
  AddEvidenceInput,
  AddFactInput,
  AddInferenceInput,
  AddLinkInput,
  AddRelatedContextInput,
  ChangeEventType,
  ContextQuery,
  RetrievalResult,
  ScopeType,
} from "./types";
import {
  canTransitionLifecycle,
  computeRelevanceScore,
  DEFAULT_RETRIEVAL_LIMIT,
} from "./types";
import {
  createRetrievalAPI,
  retrievalToCurrentState,
} from "./retrieval";

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
    patternOnlyContextIds: Set<string>;
    contexts: Record<string, SecretaryContext>;
    evidence: Record<string, Evidence>;
    createContext: (input: CreateContextInput) => SecretaryContext;
    getContext: (id: string) => SecretaryContext | undefined;
    getAllContexts: () => SecretaryContext[];
    getByLifecycle: (status: LifecycleStatus) => SecretaryContext[];
    getByType: (type: string) => SecretaryContext[];
    getBySource: (source: SourceType) => SecretaryContext[];
    archiveContext: (id: string) => void;
    deleteContext: (id: string) => void;
    transitionLifecycle: (id: string, newLifecycle: LifecycleStatus) => boolean;
    addEvidence: (contextId: string, ev: Omit<Evidence, "id">) => void;
    getEvidence: (id: string) => Evidence | undefined;
    getEvidenceForContext: (contextId: string) => Evidence[];
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
    getAllEvidence: () => Record<string, Evidence>;
    markPatternOnly: (contextId: string) => void;
    addContextTag: (contextId: string, tag: string) => void;
    influencePriority: (contextId: string, delta: number) => void;
    isPatternOnly: (contextId: string) => boolean;
    clearPatternOnly: (contextId: string) => void;
  }>()(
    persist(
      (set, get) => ({
        contexts: {},
        evidence: {},        patternOnlyContextIds: new Set<string>(),

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

        getAllContexts: () => Object.values(get().contexts),

        getByLifecycle: (status) =>
          Object.values(get().contexts).filter((context) => context.lifecycle === status),

        getByType: (type) =>
          Object.values(get().contexts).filter((context) => context.type === type),

        getBySource: (source) =>
          Object.values(get().contexts).filter((context) => context.sources.includes(source)),

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

        getEvidenceForContext: (contextId) => {
          const context = get().contexts[contextId];
          if (!context) return [];
          return context.evidenceIds
            .map((eid) => get().evidence[eid])
            .filter((e): e is Evidence => e !== undefined);
        },

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
          ),    replaceAll: (contexts, evidence) => {
          const cm: Record<string, SecretaryContext> = {};
          const em: Record<string, Evidence> = {};
          contexts.forEach((c) => { cm[c.id] = c; });
          evidence.forEach((e) => { em[e.id] = e; });
          set({ contexts: cm, evidence: em });
        },
        getAllEvidence: () => {
          return { ...get().evidence };
        },
        markPatternOnly: (contextId) => {
          set((s) => {
            const next = new Set<string>(Array.from(s.patternOnlyContextIds ?? []));
            next.add(contextId);
            return { patternOnlyContextIds: next };
          });
        },

        addContextTag: (contextId: string, tag: string) => {
          const context = get().contexts[contextId];
          if (!context) return;

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                tags: [...new Set([...context.tags, tag])],
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        influencePriority: (contextId: string, delta: number) => {
          const context = get().contexts[contextId];
          if (!context) return;

          set((s) => ({
            contexts: {
              ...s.contexts,
              [contextId]: {
                ...context,
                priority: Math.max(0, Math.min(100, context.priority + delta)),
                updatedAt: new Date().toISOString(),
              },
            },
          }));
        },

        setPriority: (contextId: string, priority: number) => {
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

        isPatternOnly: (contextId) => {
          return Array.from(get().patternOnlyContextIds ?? []).includes(contextId);
        },

        clearPatternOnly: (contextId) => {
          set((s) => {
            const next = new Set<string>(Array.from(s.patternOnlyContextIds ?? []));
            next.delete(contextId);
            return { patternOnlyContextIds: next };
          });
        },
      }),
      {
        name: "test-context",
        storage: createJSONStorage(() => memoryStorage),
      },
    ),
  );
}

describe("Retrieval Layer — Scoped, Deterministic, Boundary-Preserving", () => {
  let store: ReturnType<typeof createTestStore>;
  let api: ReturnType<typeof createRetrievalAPI>;

  beforeEach(() => {
    store = createTestStore();
    api = createRetrievalAPI(store.getState());
  });

  function createContextWithProject(
    evidence: Omit<Evidence, "id">,
    projectId: string,
    type: string = "financial.transaction",
    tags: string[] = [],
    lifecycle: LifecycleStatus = "tentative" as LifecycleStatus,
  ): SecretaryContext {
    const ctx = store.getState().createContext({ evidence, type, tags, lifecycle });
    store.getState().addLink(ctx.id, {
      entityType: "project",
      entityId: projectId,
      label: `Project ${projectId}`,
      relationship: "belongs_to",
    });
    return ctx;
  }

  function createStandaloneContext(
    evidence: Omit<Evidence, "id">,
    type: string = "financial.transaction",
    tags: string[] = [],
    lifecycle: LifecycleStatus = "tentative" as LifecycleStatus,
  ): SecretaryContext {
    return store.getState().createContext({ evidence, type, tags, lifecycle });
  }

  it("1. Retrieve contexts from a specific project", () => {
    const projectA = "proj-alpha";
    const t1 = new Date(2026, 0, 1, 10, 0, 0).toISOString();
    const t2 = new Date(2026, 0, 1, 11, 0, 0).toISOString();

    const ctx1 = createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Expense for project A" },
        capturedAt: t1,
        confidence: "high",
      },
      projectA,
      "financial.transaction",
      ["finance"],
    );

    const ctx2 = createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Another expense for project A" },
        capturedAt: t2,
        confidence: "high",
      },
      projectA,
      "financial.transaction",
      ["finance"],
    );

    const result = api.queryContexts({
      scope: { kind: "project", projectId: projectA },
    });

    expect(result.contexts.length).toBeGreaterThanOrEqual(2);
    expect(result.totalMatched).toBeGreaterThanOrEqual(2);
    const ids = result.contexts.map((c) => c.id);
    expect(ids).toContain(ctx1.id);
    expect(ids).toContain(ctx2.id);
  });

  it("2. Contexts from another project are NOT returned", () => {
    const projectA = "proj-alpha";
    const projectB = "proj-beta";

    createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Project A context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      projectA,
    );

    createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Project B context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      projectB,
    );

    const resultA = api.queryContexts({
      scope: { kind: "project", projectId: projectA },
    });
    const resultB = api.queryContexts({
      scope: { kind: "project", projectId: projectB },
    });

    expect(resultA.contexts.some((c) => c.links.some((l) => l.entityId === projectB))).toBe(false);
    expect(resultB.contexts.some((c) => c.links.some((l) => l.entityId === projectA))).toBe(false);    const aIds = resultA.contexts.map((c) => c.id);
    const bIds = resultB.contexts.map((c) => c.id);
    const bIdSet = new Set(bIds);
    expect(aIds.every((id) => !bIdSet.has(id))).toBe(true);
  });

  it("3. Retrieve by Context type", () => {
    createStandaloneContext(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Finance event" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      "financial.transaction",
    );

    createStandaloneContext(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Calendar event" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      "calendar.event",
    );

    const financeResult = api.queryContexts({
      type: "financial.transaction",
    });

    expect(financeResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(financeResult.contexts.every((c) => c.type === "financial.transaction")).toBe(true);

    const calendarResult = api.queryContexts({
      type: "calendar.event",
    });
    expect(calendarResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(calendarResult.contexts.every((c) => c.type === "calendar.event")).toBe(true);
  });

  it("4. Retrieve by tags", () => {
    store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Tagged context 1" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      tags: ["urgent", "review"],
    });

    store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Tagged context 2" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      tags: ["urgent"],
    });

    store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "No tags" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const urgentResult = api.queryContexts({
      tags: ["urgent"],
    });
    expect(urgentResult.contexts.length).toBeGreaterThanOrEqual(2);
    expect(urgentResult.contexts.every((c) => c.tags.includes("urgent"))).toBe(true);

    const urgentReviewResult = api.queryContexts({
      tags: ["urgent", "review"],
    });
    expect(urgentReviewResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(urgentReviewResult.contexts.every((c) =>
      c.tags.includes("urgent") && c.tags.includes("review")
    )).toBe(true);
  });

  it("5. Retrieve by lifecycle", () => {
    const ctx1 = createStandaloneContext(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Tentative context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      "financial.transaction",
      [],
      "tentative",
    );

    store.getState().transitionLifecycle(ctx1.id, "confirmed");
    const ctx2 = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Tentative context 2" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const tentativeResult = api.queryContexts({
      lifecycle: "tentative",
    });
    expect(tentativeResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(tentativeResult.contexts.every((c) => c.lifecycle === "tentative")).toBe(true);

    const confirmedResult = api.queryContexts({
      lifecycle: "confirmed",
    });
    expect(confirmedResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(confirmedResult.contexts.every((c) => c.lifecycle === "confirmed")).toBe(true);
  });

  it("6. Pattern-only context remains pattern-only after retrieval", () => {
    const storeState = store.getState();
    const ctx = storeState.createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Pattern-only observation" },
        capturedAt: new Date().toISOString(),
        confidence: "medium",
      },
      tags: ["observed"],
    });

    storeState.markPatternOnly(ctx.id);
    expect(storeState.isPatternOnly(ctx.id)).toBe(true);

    const result = api.queryContexts({
      scope: { kind: "all" },
    });

    const retrieved = result.contexts.find((c) => c.id === ctx.id);
    expect(retrieved).toBeDefined();
    expect(storeState.isPatternOnly(ctx.id)).toBe(true);
  });

  it("7. Query/relevance filtering works deterministically", () => {
    store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Coffee at cafe" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: "financial.transaction",
      tags: ["food"],
    });

    store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Salary deposit" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: "financial.transaction.income",
      tags: ["salary"],
    });

    const coffeeResult = api.queryContexts({
      query: "coffee",
    });
    expect(coffeeResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(coffeeResult.contexts[0].evidenceIds[0]).toBeDefined();
    const ev = store.getState().getEvidence(coffeeResult.contexts[0].evidenceIds[0]);
    expect(ev?.content.kind).toBe("text");
    expect((ev as any).content.text.toLowerCase().includes("coffee")).toBe(true);

    const salaryResult = api.queryContexts({
      query: "salary",
    });
    expect(salaryResult.contexts.length).toBeGreaterThanOrEqual(1);
    const salaryEv = store.getState().getEvidence(salaryResult.contexts[0].evidenceIds[0]);
    expect(salaryEv?.content.kind).toBe("text");
    expect((salaryEv as any).content.text.toLowerCase().includes("salary")).toBe(true);
  });

  it("8. Result ordering is deterministic", () => {
    const t1 = new Date(2026, 0, 1, 10, 0, 0).toISOString();
    const t2 = new Date(2026, 0, 1, 11, 0, 0).toISOString();
    const t3 = new Date(2026, 0, 1, 12, 0, 0).toISOString();

    createStandaloneContext(
      { sourceType: "user", sourceId: null, content: { kind: "text", text: "First" }, capturedAt: t1, confidence: "high" },
      "financial.transaction",
    );
    createStandaloneContext(
      { sourceType: "user", sourceId: null, content: { kind: "text", text: "Second" }, capturedAt: t2, confidence: "high" },
      "financial.transaction",
    );
    createStandaloneContext(
      { sourceType: "user", sourceId: null, content: { kind: "text", text: "Third" }, capturedAt: t3, confidence: "high" },
      "financial.transaction",
    );

    const ascResult = api.queryContexts({
      orderBy: "createdAt",
    });
    expect(ascResult.contexts[0].createdAt).toBe(t1);
    expect(ascResult.contexts[1].createdAt).toBe(t2);
    expect(ascResult.contexts[2].createdAt).toBe(t3);

    const descResult = api.queryContexts({
      orderBy: "createdAt-desc",
    });
    expect(descResult.contexts[0].createdAt).toBe(t3);
    expect(descResult.contexts[1].createdAt).toBe(t2);
    expect(descResult.contexts[2].createdAt).toBe(t1);
  });

  it("9. Limit works", () => {
    for (let i = 0; i < 5; i++) {
      createStandaloneContext(
        {
          sourceType: "user",
          sourceId: null,
          content: { kind: "text", text: `Context ${i}` },
          capturedAt: new Date(2026, 0, 1, i, 0, 0).toISOString(),
          confidence: "high",
        },
      );
    }

    const limitedResult = api.queryContexts({
      limit: 2,
    });
    expect(limitedResult.contexts.length).toBe(2);
    expect(limitedResult.totalMatched).toBeGreaterThanOrEqual(5);
    expect(limitedResult.totalMatched).toBe(5);
  });

  it("10. Empty result behaves correctly", () => {
    const result = api.queryContexts({
      scope: { kind: "project", projectId: "nonexistent-project" },
    });

    expect(result.contexts.length).toBe(0);
    expect(result.totalMatched).toBe(0);
    expect(result.scopeLabel).toContain("project: nonexistent-project");
    expect(result.includesPatternOnly).toBe(true);
  });

  it("11. Existing ContextStore behavior remains unchanged", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Test" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const retrieved = store.getState().getContext(ctx.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe("unknown");    store.getState().addContextTag(ctx.id, "test-tag");

    store.getState().transitionLifecycle(ctx.id, "confirmed");
    expect(store.getState().getContext(ctx.id)!.lifecycle).toBe("confirmed");

    const result = api.queryContexts({
      lifecycle: "confirmed",
    });
    expect(result.contexts.some((c) => c.id === ctx.id)).toBe(true);
  });

  it("12. Retrieval does NOT mutate stored Context", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Original" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: "financial.transaction",
    });

    const before = store.getState().getContext(ctx.id)!;
    const beforeEv = store.getState().getEvidence(ctx.evidenceIds[0]);

    api.queryContexts({ scope: { kind: "all" } });
    api.queryContexts({ type: "financial.transaction" });
    api.queryContexts({ tags: ["nonexistent"] });
    api.queryContexts({ limit: 1 });

    const after = store.getState().getContext(ctx.id)!;
    const afterEv = store.getState().getEvidence(ctx.evidenceIds[0]);

    expect(after.id).toBe(before.id);
    expect(after.type).toBe(before.type);
    expect(after.lifecycle).toBe(before.lifecycle);
    expect(after.facts).toEqual(before.facts);
    expect(after.inferences).toEqual(before.inferences);
    expect(after.links).toEqual(before.links);
    expect(after.tags).toEqual(before.tags);
    expect(after.priority).toBe(before.priority);
    expect(after.archived).toBe(before.archived);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).toBe(before.updatedAt);

    expect(afterEv?.id).toBe(beforeEv?.id);
    expect(afterEv?.sourceType).toBe(beforeEv?.sourceType);
    expect(afterEv?.content).toEqual(beforeEv?.content);
  });

  it("13. computeRelevanceScore is deterministic", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Coffee purchase at cafe in Bangkok" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: "financial.transaction",
      tags: ["food", "beverage"],
    });

    const evidenceMap = store.getState().getAllEvidence();

    const score1 = computeRelevanceScore(ctx, evidenceMap, "coffee");
    const score2 = computeRelevanceScore(ctx, evidenceMap, "coffee");
    expect(score1).toBe(score2);
    expect(score1).toBeGreaterThan(0);
    expect(score1).toBeLessThanOrEqual(1);
  });

  it("14. retrieveByProject works as convenience wrapper", () => {
    const projectId = "proj-main";
    createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Project main context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      projectId,
    );

    const result = api.retrieveByProject(projectId, { type: "financial.transaction" });
    expect(result.totalMatched).toBeGreaterThanOrEqual(1);
    expect(result.scopeLabel).toContain("project: proj-main");
  });

  it("15. retrieveByEntity works for non-project entities", () => {
    const personId = "person-ae";
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Transfer to person AE" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });
    store.getState().addLink(ctx.id, {
      entityType: "person",
      entityId: personId,
      label: "คุณเอ",
      relationship: "recipient",
    });

    const result = api.retrieveByEntity("person", personId);
    expect(result.totalMatched).toBeGreaterThanOrEqual(1);
    expect(result.scopeLabel).toContain("entity: person person-ae");
  });

  it("16. contextBelongsToProject correctly identifies project membership", () => {
    const projectA = "proj-alpha";
    const projectB = "proj-beta";

    const ctxA = createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Project A context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      projectA,
    );
    createContextWithProject(
      {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Project B context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      projectB,
    );

    expect(api.contextBelongsToProject(ctxA.id, projectA)).toBe(true);
    expect(api.contextBelongsToProject(ctxA.id, projectB)).toBe(false);
  });

  it("17. getContextScope returns correct projects and entities", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Multi-linked context" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().addLink(ctx.id, {
      entityType: "project",
      entityId: "proj-office",
      label: "ออฟฟิศใหม่",
      relationship: "purpose",
    });
    store.getState().addLink(ctx.id, {
      entityType: "person",
      entityId: "person-ae",
      label: "คุณเอ",
      relationship: "recipient",
    });
    store.getState().addLink(ctx.id, {
      entityType: "account",
      entityId: "acc-kbank",
      label: "KBank",
      relationship: "source",
    });

    const scope = api.getContextScope(ctx.id);
    expect(scope.projects.length).toBe(1);
    expect(scope.projects[0].projectId).toBe("proj-office");
    expect(scope.projects[0].label).toBe("ออฟฟิศใหม่");

    expect(scope.entities.length).toBe(2);
    expect(scope.entities.some((e) => e.entityType === "person" && e.entityId === "person-ae")).toBe(true);
    expect(scope.entities.some((e) => e.entityType === "account" && e.entityId === "acc-kbank")).toBe(true);
  });

  it("18. retrievalToCurrentState preserves retrieval result", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Context for current state" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: "financial.transaction",
      tags: ["test"],
    });

    const query: ContextQuery = {
      scope: { kind: "all" },
      type: "financial.transaction",
      tags: ["test"],
    };

    const retrievalResult = api.queryContexts(query);
    const currentState = retrievalToCurrentState(retrievalResult);

    expect(currentState.contexts.length).toBe(retrievalResult.contexts.length);
    expect(currentState.metadata.retrievalQuery).toEqual(query);
    expect(currentState.metadata.scope).toBe(retrievalResult.scopeLabel);
    expect(currentState.metadata.totalMatched).toBe(retrievalResult.totalMatched);
    expect(currentState.metadata.ordering).toBe(retrievalResult.ordering);
  });

  it("19. Priority filter works", () => {
    const ctx19Low = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Low priority" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });    store.getState().influencePriority(ctx19Low.id, 10);

    const ctx19High = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "High priority" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });    store.getState().influencePriority(ctx19High.id, 90);

    const highPriorityResult = api.queryContexts({
      priorityRange: { min: 80, max: 100 },
    });
    expect(highPriorityResult.contexts.every((c: { priority: number }) => c.priority >= 80 && c.priority <= 100)).toBe(true);
    expect(highPriorityResult.contexts.length).toBeGreaterThanOrEqual(1);
  });

  it("20. Time range filter works", () => {
    const t1 = new Date(2026, 0, 1, 10, 0, 0).toISOString();
    const t2 = new Date(2026, 0, 2, 10, 0, 0).toISOString();
    const t3 = new Date(2026, 0, 3, 10, 0, 0).toISOString();

    createStandaloneContext(
      { sourceType: "user", sourceId: null, content: { kind: "text", text: "Early" }, capturedAt: t1, confidence: "high" },
    );
    createStandaloneContext(
      { sourceType: "user", sourceId: null, content: { kind: "text", text: "Middle" }, capturedAt: t2, confidence: "high" },
    );
    createStandaloneContext(
      { sourceType: "user", sourceId: null, content: { kind: "text", text: "Late" }, capturedAt: t3, confidence: "high" },
    );

    const rangeResult = api.queryContexts({
      timeRange: { since: t2, until: t3 },
    });
    expect(rangeResult.contexts.length).toBeGreaterThanOrEqual(1);
    expect(rangeResult.contexts.every((c) => c.createdAt >= t2 && c.createdAt < t3)).toBe(true);
  });

  it("21. Default limit is applied when not specified", () => {
    for (let i = 0; i <= DEFAULT_RETRIEVAL_LIMIT; i++) {
      createStandaloneContext(
        {
          sourceType: "user",
          sourceId: null,
          content: { kind: "text", text: `Context ${i}` },
          capturedAt: new Date(2026, 0, 1, i, 0, 0).toISOString(),
          confidence: "high",
        },
      );
    }

    const result = api.queryContexts({});
    expect(result.contexts.length).toBeLessThanOrEqual(DEFAULT_RETRIEVAL_LIMIT);
    expect(result.totalMatched).toBe(DEFAULT_RETRIEVAL_LIMIT + 1);
  });

  it("22. Source filter works", () => {
    store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "User input" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });
    store.getState().createContext({
      evidence: {
        sourceType: "notification",
        sourceId: "notif-1",
        content: { kind: "text", text: "Notification input" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const userResult = api.queryContexts({
      source: "user",
    });
    expect(userResult.contexts.every((c) => c.sources.includes("user"))).toBe(true);
    expect(userResult.contexts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Regression — Existing ContextStore behavior", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("createContext still works with minimal evidence", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Minimal" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    expect(ctx.id).toBeDefined();
    expect(ctx.lifecycle).toBe("tentative");
    expect(ctx.evidenceIds.length).toBe(1);
    expect(ctx.facts).toEqual([]);
    expect(ctx.inferences).toEqual([]);
  });

  it("addEvidence still works", () => {
    const ctx = store.getState().createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: { kind: "text", text: "Original" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.getState().addEvidence(ctx.id, {
      sourceType: "email",
      sourceId: "email-1",
      content: { kind: "text", text: "Additional evidence" },
      capturedAt: new Date().toISOString(),
      confidence: "high",
    });

    const updated = store.getState().getContext(ctx.id)!;
    expect(updated.evidenceIds.length).toBe(2);
    expect(updated.sources).toContain("email");
  });
});
