import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Evidence, SecretaryContext } from "./types.ts";
import { buildContextCardModel, buildStatement } from "./presentation.ts";

function makeContext(overrides: Partial<SecretaryContext> = {}): SecretaryContext {
  return {
    id: "ctx-1",
    type: "financial.transaction",
    lifecycle: "tentative",
    evidenceIds: ["ev-1"],
    facts: [],
    inferences: [],
    primarySource: "user",
    sources: ["user"],
    links: [],
    relatedContexts: [],
    history: [],
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    createdBy: "user",
    expiresAt: null,
    priority: 50,
    tags: ["capture"],
    archived: false,
    sharedWithUserIds: null,
    canonicalId: null,
    ...overrides,
  };
}

const evidence: Evidence = {
  id: "ev-1",
  sourceType: "user",
  sourceId: null,
  content: { kind: "text", text: "กาแฟ 65" },
  capturedAt: "2026-09-07T00:00:00.000Z",
  confidence: "high",
};

describe("ContextCard presentation mapping", () => {
  it("derives a statement from facts without mutating the Context", () => {
    const context = makeContext({
      facts: [{ id: "fact-1", evidenceIds: ["ev-1"], field: "amount", value: 65, establishedAt: "now" }],
    });
    const before = structuredClone(context);

    const model = buildContextCardModel(context, { [evidence.id]: evidence });

    assert.deepEqual(model.statement, { text: "amount: 65", basedOnFactIds: ["fact-1"] });
    assert.deepEqual(context, before);
  });

  it("keeps evidence, facts, inferences, and related contexts separate", () => {
    const context = makeContext({
      facts: [{ id: "fact-1", evidenceIds: ["ev-1"], field: "amount", value: 65, establishedAt: "now" }],
      inferences: [{
        id: "inference-1",
        evidenceIds: ["ev-1"],
        factIds: ["fact-1"],
        field: "category",
        value: "food",
        confidence: "medium",
        reasoning: "จากข้อความหลักฐาน",
        inferredAt: "now",
        confirmable: true,
        confirmed: false,
      }],
      relatedContexts: [{
        id: "related-1",
        relatedContextId: "ctx-2",
        relationType: "related",
        description: "same receipt",
        source: "user",
        createdAt: "now",
      }],
    });

    const model = buildContextCardModel(context, { [evidence.id]: evidence });

    assert.equal(model.evidence.length, 1);
    assert.equal(model.facts.length, 1);
    assert.equal(model.inferences.length, 1);
    assert.equal(model.relatedContexts.length, 1);
    assert.equal(buildStatement({ facts: [] }), null);
  });
});