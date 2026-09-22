/**
 * Overview lib tests — กรอง/ค้น/เรียง/นับของหน้ารวมบริบท
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Evidence, SecretaryContext } from "./types.ts";
import {
  defaultOverviewQuery,
  overviewCounts,
  overviewSearchText,
  selectOverviewContexts,
} from "./overview.ts";

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

const evidence: Record<string, Evidence> = {
  "ev-1": {
    id: "ev-1",
    sourceType: "user",
    sourceId: null,
    content: { kind: "text", text: "นัดส่งเอกสารที่ธนาคาร" },
    capturedAt: "2026-09-21T00:00:00.000Z",
    confidence: "high",
  },
  "ev-2": {
    id: "ev-2",
    sourceType: "voice",
    sourceId: null,
    content: { kind: "text", text: "ประชุมทีมเจ้าหนี้" },
    capturedAt: "2026-09-21T01:00:00.000Z",
    confidence: "medium",
  },
};

const a = makeContext({ id: "a", evidenceIds: ["ev-1"], createdAt: "2026-09-21T00:00:00.000Z" });
const b = makeContext({
  id: "b",
  evidenceIds: ["ev-2"],
  primarySource: "voice",
  sources: ["voice"],
  createdAt: "2026-09-21T02:00:00.000Z",
  lifecycle: "confirmed",
});
const archived = makeContext({
  id: "z",
  evidenceIds: [],
  archived: true,
  createdAt: "2026-09-21T03:00:00.000Z",
});

const record = { a, b, z: archived };

describe("selectOverviewContexts — กรองและเรียง", () => {
  it("ค่าเริ่มต้น: ตัด archived เรียงใหม่สุดก่อน", () => {
    const list = selectOverviewContexts(record, evidence, defaultOverviewQuery);
    assert.deepEqual(list.map((c) => c.id), ["b", "a"]);
  });

  it("กรองตาม lifecycle", () => {
    const list = selectOverviewContexts(record, evidence, {
      ...defaultOverviewQuery,
      lifecycle: "confirmed",
    });
    assert.deepEqual(list.map((c) => c.id), ["b"]);
  });

  it("กรองตาม source เช่น voice", () => {
    const list = selectOverviewContexts(record, evidence, {
      ...defaultOverviewQuery,
      source: "voice",
    });
    assert.deepEqual(list.map((c) => c.id), ["b"]);
  });

  it("ค้นหาเจอจากข้อความ evidence (ไม่สนตัวพิมพ์)", () => {
    const list = selectOverviewContexts(record, evidence, {
      ...defaultOverviewQuery,
      search: "ธนาคาร",
    });
    assert.deepEqual(list.map((c) => c.id), ["a"]);
  });

  it("ค้นหาเจอจาก type และ tags ด้วย", () => {
    const byType = selectOverviewContexts(record, evidence, {
      ...defaultOverviewQuery,
      search: "user.note",
    });
    assert.equal(byType.length, 2);

    const byTag = selectOverviewContexts(record, evidence, {
      ...defaultOverviewQuery,
      search: "context",
    });
    assert.equal(byTag.length, 2);
  });

  it("เรียงตาม priority ก่อนแล้วค่อยใหม่สุด", () => {
    const high = makeContext({ id: "h", priority: 90, createdAt: "2026-09-20T00:00:00.000Z" });
    const list = selectOverviewContexts(
      { high, a },
      evidence,
      { ...defaultOverviewQuery, orderBy: "priority-desc" },
    );
    assert.deepEqual(list.map((c) => c.id), ["h", "a"]);
  });

  it("เรียงเก่าสุดก่อนเมื่อสั่ง createdAt", () => {
    const list = selectOverviewContexts(record, evidence, {
      ...defaultOverviewQuery,
      orderBy: "createdAt",
    });
    assert.deepEqual(list.map((c) => c.id), ["a", "b"]);
  });
});

describe("overviewCounts — นับสรุป", () => {
  it("นับเฉพาะ non-archived แยกตาม lifecycle", () => {
    const counts = overviewCounts(record);
    assert.deepEqual(counts, {
      total: 2,
      tentative: 1,
      confirmed: 1,
      completed: 0,
      cancelled: 0,
    });
  });

  it("ชุดว่างให้ศูนย์ทุกช่อง", () => {
    assert.deepEqual(overviewCounts({}), {
      total: 0,
      tentative: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    });
  });
});

describe("overviewSearchText — แหล่งข้อความค้น", () => {
  it("รวม evidence text, type, tags เป็นข้อความเดียวตัวพิมพ์เล็ก", () => {
    const text = overviewSearchText(a, evidence);
    assert.ok(text.includes("ธนาคาร"));
    assert.ok(text.includes("user.note"));
    assert.ok(text.includes("context"));
    assert.equal(text, text.toLowerCase());
  });

  it("evidence แบบ structured ถูกแผ่เป็น key value", () => {
    const ctx = makeContext({
      id: "s",
      evidenceIds: ["ev-s"],
    });
    const structured: Record<string, Evidence> = {
      "ev-s": {
        id: "ev-s",
        sourceType: "external",
        sourceId: null,
        content: { kind: "structured", data: { amount: 15000 } },
        capturedAt: "2026-09-21T00:00:00.000Z",
        confidence: "high",
      },
    };
    const text = overviewSearchText(ctx, structured);
    assert.ok(text.includes("amount"));
    assert.ok(text.includes("15000"));
  });
});
