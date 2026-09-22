/**
 * Context sync — mapper + LWW merge tests
 * ชื่อกรณีทดสอบเป็นภาษาไทย (ตามธรรมเนียมของชุดทดสอบ Context)
 *
 * ทดสอบ mapper (camelCase ↔ snake_case) และ mergeContexts (last-write-wins)
 * ทั้งหมดเป็น pure function — ไม่แตะเครือข่าย ไม่แตะ Supabase client
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Evidence, SecretaryContext } from "../context/types.ts";
import { useContextStore } from "../context/store.ts";
import {
  contextToRow,
  rowToContext,
  evidenceToRow,
  rowToEvidence,
  mergeContexts,
} from "./sync.ts";

// ── Fixtures ─────────────────────────────────────────────────

function makeContext(overrides: Partial<SecretaryContext> = {}): SecretaryContext {
  return {
    id: "ctx-1",
    type: "user.note",
    lifecycle: "tentative",
    evidenceIds: ["ev-1"],
    facts: [],
    inferences: [],
    primarySource: "user",
    sources: ["user"],
    links: [],
    relatedContexts: [],
    history: [],
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    createdBy: "user",
    expiresAt: null,
    priority: 50,
    tags: ["context"],
    archived: false,
    sharedWithUserIds: null,
    canonicalId: null,
    deletedAt: null,
    ...overrides,
  };
}

const EV_1: Evidence = {
  id: "ev-1",
  sourceType: "user",
  sourceId: null,
  content: { kind: "text", text: "นัดส่งเอกสารที่ธนาคาร" },
  capturedAt: "2026-09-21T00:00:00.000Z",
  confidence: "high",
};

const EV_2: Evidence = {
  id: "ev-2",
  sourceType: "voice",
  sourceId: null,
  content: { kind: "text", text: "ประชุมทีมเจ้าหนี้" },
  capturedAt: "2026-09-21T01:00:00.000Z",
  confidence: "medium",
};

// ── Mappers ──────────────────────────────────────────────────

describe("contextToRow / rowToContext — แปลงกลับไปกลับมาได้ครบ", () => {
  it("context ครบทุกฟิลด์ → row snake_case ตรง schema", () => {
    const ctx = makeContext({
      facts: [
        {
          id: "f1",
          evidenceIds: ["ev-1"],
          field: "amount",
          value: 15000,
          establishedAt: "2026-09-21T00:00:00.000Z",
        },
      ],
      inferences: [
        {
          id: "inf-1",
          evidenceIds: ["ev-1"],
          factIds: [],
          field: "purpose",
          value: "ส่งให้ลูก",
          confidence: "low",
          reasoning: "matched",
          inferredAt: "2026-09-21T00:00:00.000Z",
          confirmable: true,
          confirmed: false,
        },
      ],
      links: [
        {
          id: "l1",
          entityType: "person",
          entityId: "p1",
          label: "คุณเอ",
          relationship: "sender",
          source: "user",
          createdAt: "2026-09-21T00:00:00.000Z",
        },
      ],
      history: [
        {
          id: "h1",
          type: "created",
          description: "Context created",
          changedBy: "user",
          occurredAt: "2026-09-21T00:00:00.000Z",
        },
      ],
      expiresAt: "2026-12-31T00:00:00.000Z",
      sharedWithUserIds: ["u9"],
      canonicalId: "canon-1",
      priority: 90,
      archived: true,
    });

    const row = contextToRow(ctx, "user-1");
    assert.equal(row.id, "ctx-1");
    assert.equal(row.user_id, "user-1");
    assert.equal(row.type, "user.note");
    assert.equal(row.lifecycle, "tentative");
    assert.deepEqual(row.evidence_ids, ["ev-1"]);
    assert.equal(row.facts.length, 1);
    assert.equal(row.inferences.length, 1);
    assert.equal(row.primary_source, "user");
    assert.deepEqual(row.sources, ["user"]);
    assert.equal(row.links.length, 1);
    assert.equal(row.history.length, 1);
    assert.equal(row.created_by, "user");
    assert.equal(row.expires_at, "2026-12-31T00:00:00.000Z");
    assert.equal(row.priority, 90);
    assert.deepEqual(row.tags, ["context"]);
    assert.equal(row.archived, true);
    assert.deepEqual(row.shared_with_user_ids, ["u9"]);
    assert.equal(row.canonical_id, "canon-1");
    assert.equal(row.created_at, "2026-09-21T00:00:00.000Z");
    // updated_at = client timestamp (LWW arbitration), ไม่ใช่ server now()
    assert.equal(row.updated_at, "2026-09-21T00:00:00.000Z");
  });

  it("rowToContext ได้ค่ากลับครบทุกฟิลด์", () => {
    const row = {
      id: "ctx-2",
      user_id: "user-1",
      type: "financial.transaction",
      lifecycle: "confirmed",
      evidence_ids: ["ev-1", "ev-2"],
      facts: [],
      inferences: [],
      primary_source: "voice",
      sources: ["user", "voice"],
      links: [],
      related_contexts: [],
      history: [],
      created_by: "ai",
      expires_at: null,
      priority: 70,
      tags: ["voice"],
      archived: false,
      shared_with_user_ids: null,
      canonical_id: null,
      created_at: "2026-09-20T00:00:00.000Z",
      updated_at: "2026-09-21T05:00:00.000Z",
    };
    const ctx = rowToContext(row);
    assert.equal(ctx.id, "ctx-2");
    assert.equal(ctx.type, "financial.transaction");
    assert.equal(ctx.lifecycle, "confirmed");
    assert.deepEqual(ctx.evidenceIds, ["ev-1", "ev-2"]);
    assert.equal(ctx.primarySource, "voice");
    assert.deepEqual(ctx.sources, ["user", "voice"]);
    assert.equal(ctx.createdBy, "ai");
    assert.equal(ctx.priority, 70);
    assert.deepEqual(ctx.tags, ["voice"]);
    assert.equal(ctx.expiresAt, null);
    assert.equal(ctx.createdAt, "2026-09-20T00:00:00.000Z");
    assert.equal(ctx.updatedAt, "2026-09-21T05:00:00.000Z");
  });

  it("row ที่คอลัมน์ jsonb เป็น null ปลอดภัย → array ว่าง", () => {
    const ctx = rowToContext({
      id: "ctx-3",
      type: "user.note",
      lifecycle: "tentative",
      evidence_ids: null,
      facts: null,
      inferences: null,
      primary_source: "user",
      sources: null,
      links: null,
      related_contexts: null,
      history: null,
      created_by: "user",
      expires_at: null,
      priority: 50,
      tags: null,
      archived: false,
      shared_with_user_ids: null,
      canonical_id: null,
      created_at: "2026-09-21T00:00:00.000Z",
      updated_at: "2026-09-21T00:00:00.000Z",
    });
    assert.deepEqual(ctx.evidenceIds, []);
    assert.deepEqual(ctx.facts, []);
    assert.deepEqual(ctx.inferences, []);
    assert.deepEqual(ctx.sources, []);
    assert.deepEqual(ctx.links, []);
    assert.deepEqual(ctx.relatedContexts, []);
    assert.deepEqual(ctx.history, []);
    assert.deepEqual(ctx.tags, []);
  });

  it("evidence กลับไปกลับมาได้ครบ", () => {
    const row = evidenceToRow(EV_1, "user-1");
    assert.equal(row.id, "ev-1");
    assert.equal(row.user_id, "user-1");
    assert.equal(row.source_type, "user");
    assert.equal(row.source_id, null);
    assert.deepEqual(row.content, EV_1.content);
    assert.equal(row.captured_at, EV_1.capturedAt);
    assert.equal(row.confidence, "high");

    const back = rowToEvidence(row);
    assert.deepEqual(back, EV_1);
  });

  it("evidence source_id เป็น null-safe", () => {
    const back = rowToEvidence({
      id: "ev-9",
      source_type: "email",
      source_id: undefined,
      content: { kind: "text", text: "x" },
      captured_at: "2026-09-21T00:00:00.000Z",
      confidence: "low",
    });
    assert.equal(back.sourceId, null);
  });
});

// ── mergeContexts (LWW) ──────────────────────────────────────

describe("mergeContexts — last-write-wins conflict handling", () => {
  it("remote-only context → ถูกนำเข้าพร้อม evidence ที่ยังไม่มี", () => {
    const remote = makeContext({ id: "r1", evidenceIds: ["ev-1"] });
    const result = mergeContexts(
      { contexts: {}, evidence: {} },
      [remote],
      [EV_1],
    );
    assert.ok(result.contexts.r1);
    assert.ok(result.evidence["ev-1"]);
    // ไม่ต้อง push อะไรกลับ
    assert.equal(result.toPush.length, 0);
    assert.equal(result.evidenceToPush.length, 0);
  });

  it("local แก้ใหม่กว่า (updatedAt ใหม่กว่า) → local ชนะ และถูกทำเครื่องหมาย push กลับ", () => {
    const local = makeContext({
      id: "c1",
      lifecycle: "confirmed",
      updatedAt: "2026-09-22T10:00:00.000Z",
    });
    const remote = makeContext({
      id: "c1",
      lifecycle: "tentative",
      updatedAt: "2026-09-22T08:00:00.000Z",
    });
    const result = mergeContexts(
      { contexts: { c1: local }, evidence: { "ev-1": EV_1 } },
      [remote],
      [],
    );
    assert.equal(result.contexts.c1.lifecycle, "confirmed");
    assert.equal(result.toPush.length, 1);
    assert.equal(result.toPush[0].id, "c1");
  });

  it("remote แก้ใหม่กว่า → remote ชนะ และไม่ push กลับ", () => {
    const local = makeContext({
      id: "c1",
      lifecycle: "tentative",
      updatedAt: "2026-09-22T08:00:00.000Z",
    });
    const remote = makeContext({
      id: "c1",
      lifecycle: "confirmed",
      updatedAt: "2026-09-22T10:00:00.000Z",
    });
    const result = mergeContexts(
      { contexts: { c1: local }, evidence: { "ev-1": EV_1 } },
      [remote],
      [EV_1],
    );
    assert.equal(result.contexts.c1.lifecycle, "confirmed");
    assert.equal(result.toPush.length, 0);
  });

  it("local-only (บรรทัดใหม่บนเครื่องนี้) → push พร้อม evidence ทั้งหมด", () => {
    const local = makeContext({ id: "new-1", evidenceIds: ["ev-1", "ev-2"] });
    const result = mergeContexts(
      { contexts: { "new-1": local }, evidence: { "ev-1": EV_1, "ev-2": EV_2 } },
      [],
      [],
    );
    assert.ok(result.contexts["new-1"]);
    assert.equal(result.toPush.length, 1);
    assert.equal(result.evidenceToPush.length, 2);
  });

  it("evidence ที่ตีความไม่ได้ (ไม่มีทั้ง local/remote) → ข้ามแล้วไม่พัง", () => {
    const remote = makeContext({ id: "r1", evidenceIds: ["ev-missing"] });
    const result = mergeContexts({ contexts: {}, evidence: {} }, [remote], []);
    assert.ok(result.contexts.r1);
    assert.equal(result.evidence["ev-missing"], undefined);
  });

  it("ชุดว่างทั้งสองฝั่ง → ผลลัพธ์ว่างเปล่า", () => {
    const result = mergeContexts({ contexts: {}, evidence: {} }, [], []);
    assert.deepEqual(result.contexts, {});
    assert.deepEqual(result.evidence, {});
    assert.equal(result.toPush.length, 0);
    assert.equal(result.evidenceToPush.length, 0);
  });
});

// ── applyRemoteContext / applyRemoteEvidence (Realtime → store) ──

describe("applyRemoteContext — realtime row ลง store แบบ LWW", () => {
  it("remote-only → ถูกใส่เข้า store", () => {
    const ctx = makeContext({ id: "rt-1", updatedAt: "2026-09-22T12:00:00.000Z" });
    useContextStore.getState().applyRemoteContext(ctx);
    assert.ok(useContextStore.getState().contexts["rt-1"]);
  });

  it("echo/เก่ากว่า local → local ไม่ถูกย้อน (LWW)", () => {
    const local = makeContext({ id: "rt-2", lifecycle: "confirmed", updatedAt: "2026-09-22T12:00:00.000Z" });
    useContextStore.getState().applyRemoteContext(local);

    const stale = makeContext({ id: "rt-2", lifecycle: "tentative", updatedAt: "2026-09-22T10:00:00.000Z" });
    useContextStore.getState().applyRemoteContext(stale);

    assert.equal(useContextStore.getState().contexts["rt-2"].lifecycle, "confirmed");
  });

  it("remote ใหม่กว่า → เขียนทับ local", () => {
    const local = makeContext({ id: "rt-3", lifecycle: "tentative", updatedAt: "2026-09-22T10:00:00.000Z" });
    useContextStore.getState().applyRemoteContext(local);

    const newer = makeContext({ id: "rt-3", lifecycle: "confirmed", updatedAt: "2026-09-22T12:00:00.000Z" });
    useContextStore.getState().applyRemoteContext(newer);

    assert.equal(useContextStore.getState().contexts["rt-3"].lifecycle, "confirmed");
  });

  it("broadcast soft-delete (deletedAt) → ลบ local copy; id ที่ไม่มี → no-op", () => {
    const ctx = makeContext({ id: "rt-4" });
    useContextStore.getState().applyRemoteContext(ctx);
    assert.ok(useContextStore.getState().contexts["rt-4"]);

    useContextStore.getState().applyRemoteContext(makeContext({ id: "rt-4", deletedAt: "2026-09-22T13:00:00.000Z" }));
    assert.equal(useContextStore.getState().contexts["rt-4"], undefined);

    // unknown id tombstone ต้องไม่พังและไม่สร้างแถวผี
    useContextStore.getState().applyRemoteContext(makeContext({ id: "rt-ghost", deletedAt: "2026-09-22T13:00:00.000Z" }));
    assert.equal(useContextStore.getState().contexts["rt-ghost"], undefined);
  });
});

describe("applyRemoteEvidence — immutable, echo เป็น no-op", () => {
  it("evidence ใหม่ → ถูกใส่; echo ซ้ำ → ตัวแรกชนะ (ไม่ overwrite)", () => {
    const ev: Evidence = {
      id: "rt-ev-1",
      sourceType: "user",
      sourceId: null,
      content: { kind: "text", text: "ต้นฉบับ" },
      capturedAt: "2026-09-22T12:00:00.000Z",
      confidence: "high",
    };
    useContextStore.getState().applyRemoteEvidence(ev);
    assert.equal(useContextStore.getState().evidence["rt-ev-1"].content.kind, "text");

    const echo: Evidence = { ...ev, content: { kind: "text", text: "ฉลองทับ" } };
    useContextStore.getState().applyRemoteEvidence(echo);
    const stored = useContextStore.getState().evidence["rt-ev-1"];
    assert.ok(stored.content.kind === "text" && stored.content.text === "ต้นฉบับ");
  });
});
