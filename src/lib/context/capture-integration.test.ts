/**
 * Secretary Capture -> Context Integration Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { useContextStore } from "./store.ts";

describe("Capture -> Context Integration", () => {
  it("verify store can create contexts with evidence", () => {
    const store = useContextStore.getState();

    const context = store.createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: {
          kind: "hybrid",
          text: "กาแฟ 65",
          data: {
            parsedType: "expense",
            parsedTitle: "กาแฟ",
            parsedCategory: "food",
            parsedAmount: 65,
          },
        },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
      type: "financial.transaction.expense",
      source: "user",
      lifecycle: "tentative",
      tags: ["capture", "expense"],
    });

    assert.ok(context.id);
    assert.strictEqual(context.lifecycle, "tentative");
    assert.strictEqual(context.evidenceIds.length, 1);
    assert.strictEqual(context.primarySource, "user");
  });

  it("verify no facts are automatically created from parser output", () => {
    const store = useContextStore.getState();

    const context = store.createContext({
      evidence: {
        sourceType: "user",
        sourceId: null,
        content: {
          kind: "hybrid",
          text: "กาแฟ 65",
          data: {
            parsedType: "expense",
            parsedCategory: "food",
            parsedAmount: 65,
          },
        },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const ctx = store.getContext(context.id);
    assert.ok(ctx);
    assert.strictEqual(ctx.facts.length, 0, "No facts should be auto-created");
    assert.strictEqual(ctx.inferences.length, 0, "No inferences should be auto-created");
  });

  it("verify pattern-only marking works", () => {
    const store = useContextStore.getState();

    const context = store.createContext({
      evidence: {
        sourceType: "user",
        sourceId: "test-pattern-1",
        content: { kind: "text", text: "pattern observation" },
        capturedAt: new Date().toISOString(),
        confidence: "medium",
      },
    });

    assert.strictEqual(store.isPatternOnly(context.id), false);
    store.markPatternOnly(context.id);
    assert.strictEqual(store.isPatternOnly(context.id), true);
    store.clearPatternOnly(context.id);
    assert.strictEqual(store.isPatternOnly(context.id), false);
  });

  it("verify multiple evidence from multiple sources", () => {
    const store = useContextStore.getState();

    const context = store.createContext({
      evidence: {
        sourceType: "user",
        sourceId: "input-1",
        content: { kind: "text", text: "กาแฟ 65" },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    store.addEvidence(context.id, {
      evidence: {
        sourceType: "notification",
        sourceId: "bank-txn-123",
        content: { kind: "structured", data: { amount: 65 } },
        capturedAt: new Date().toISOString(),
        confidence: "high",
      },
    });

    const ctx = store.getContext(context.id);
    assert.ok(ctx);
    assert.strictEqual(ctx.evidenceIds.length, 2);
  });
});
