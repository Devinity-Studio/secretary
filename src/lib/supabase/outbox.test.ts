/**
 * Outbox retry queue — unit tests
 * ชื่อกรณีทดสอบเป็นภาษาไทย (ตามธรรมเนียมของชุดทดสอบ Context)
 *
 * ทดสอบพฤติกรรมคิวล้วน ๆ: enqueue/dedupe/FIFO/cap/persistence/attempt budget
 * ทั้งหมดใช้ storage จำลอง (memory) และ inject replay — ไม่แตะเครือข่าย ไม่แตะ Supabase จริง
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  enqueueOutbox,
  removeFromOutbox,
  flushOutbox,
  MAX_OUTBOX_ATTEMPTS,
  __setOutboxStorageForTests,
  __resetOutboxForTests,
  __getOutboxForTests,
} from "./outbox.ts";
import type { OutboxEntry } from "./outbox.ts";

// ── Memory storage stub ──────────────────────────────────────

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    dump: () => Object.fromEntries(map) as Record<string, string>,
  };
}

function entry(overrides: Partial<OutboxEntry> = {}): Omit<OutboxEntry, "enqueuedAt" | "attempts"> {
  const id = overrides.id ?? "ctx-1";
  return {
    id,
    table: "contexts",
    op: "upsert",
    row: { id, user_id: "u1", type: "user.note" },
    ...overrides,
  };
}

let storage: ReturnType<typeof makeMemoryStorage>;

beforeEach(() => {
  storage = makeMemoryStorage();
  __setOutboxStorageForTests(storage as unknown as Storage);
  __resetOutboxForTests();
});

afterEach(() => {
  __resetOutboxForTests();
});

// ── Enqueue ──────────────────────────────────────────────────

describe("enqueueOutbox — คิวและการ dedupe", () => {
  it("เพิ่มรายการใหม่ → อยู่ท้ายคิว พร้อม timestamp และ attempts=0", () => {
    enqueueOutbox(entry());
    enqueueOutbox(entry({ id: "ctx-2", row: { id: "ctx-2" } }));

    const q = __getOutboxForTests();
    assert.equal(q.length, 2);
    assert.equal(q[0].id, "ctx-1");
    assert.equal(q[1].id, "ctx-2");
    assert.ok(q[0].enqueuedAt);
    assert.equal(q[0].attempts, 0);
  });

  it("enqueue ซ้ำ (table,id,op เดิม) → ล่าสุดชนะ คิวไม่โต", () => {
    enqueueOutbox(entry({ row: { id: "ctx-1", v: 1 } }));
    enqueueOutbox(entry({ row: { id: "ctx-1", v: 2 } }));

    const q = __getOutboxForTests();
    assert.equal(q.length, 1);
    assert.deepEqual(q[0].row, { id: "ctx-1", v: 2 });
  });

  it("คิวเต็ม 500 → รายการเก่าสุดถูกทิ้ง รายการใหม่รอด", () => {
    for (let i = 0; i < 502; i++) {
      enqueueOutbox(entry({ id: `ctx-${i}`, row: { id: `ctx-${i}` } }));
    }
    const q = __getOutboxForTests();
    assert.equal(q.length, 500);
    assert.equal(q[0].id, "ctx-2"); // ctx-0, ctx-1 ถูก drop จากหัว
    assert.equal(q[q.length - 1].id, "ctx-501");
  });

  it("คิวถูก persist ลง storage จริง (รอด reload)", () => {
    enqueueOutbox(entry());
    const raw = storage.dump()["secretary-sync-outbox-v1"];
    assert.ok(typeof raw === "string");
    const parsed = JSON.parse(raw) as OutboxEntry[];
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, "ctx-1");
  });
});

// ── removeFromOutbox ─────────────────────────────────────────

describe("removeFromOutbox — ล้างเมื่อ push ต้นทางสำเร็จ", () => {
  it("ลบทุก op ของ (table,id) ที่ระบุ — upsert ค้างกลายเป็นโมฆะเมื่อ push ใหม่สำเร็จ", () => {
    enqueueOutbox(entry({ op: "upsert" }));
    enqueueOutbox(entry({ op: "soft-delete", row: { id: "ctx-1" }, deletedAt: "2026-09-22T00:00:00.000Z" }));
    assert.equal(__getOutboxForTests().length, 2);

    removeFromOutbox("contexts", "ctx-1");
    assert.equal(__getOutboxForTests().length, 0);
  });

  it("แถวอื่นไม่ถูกแตะ", () => {
    enqueueOutbox(entry({ id: "a", row: { id: "a" } }));
    enqueueOutbox(entry({ id: "b", row: { id: "b" } }));
    removeFromOutbox("contexts", "a");
    const q = __getOutboxForTests();
    assert.equal(q.length, 1);
    assert.equal(q[0].id, "b");
  });
});

// ── flushOutbox ──────────────────────────────────────────────

describe("flushOutbox — ส่งซ้ำและการจัดการความพัง", () => {
  it("replay สำเร็จทุกรายการ → เล่นตามลำดับ FIFO แล้วคิวว่าง", async () => {
    enqueueOutbox(entry({ id: "a", row: { id: "a" } }));
    enqueueOutbox(entry({ id: "b", row: { id: "b" } }));

    const played: string[] = [];
    await flushOutbox(async (e) => {
      played.push(e.id);
      return true;
    });

    assert.deepEqual(played, ["a", "b"]);
    assert.equal(__getOutboxForTests().length, 0);
  });

  it("replay พังซ้ำทุก window → attempts สะสม ครบ MAX_OUTBOX_ATTEMPTS แล้วถูก drop", async () => {
    let calls = 0;
    enqueueOutbox(entry({ id: "x", row: { id: "x" } }));

    for (let window = 0; window < MAX_OUTBOX_ATTEMPTS; window++) {
      await flushOutbox(async () => {
        calls += 1;
        return false;
      });
    }

    assert.equal(calls, MAX_OUTBOX_ATTEMPTS); // หนึ่งครั้งต่อ window
    assert.equal(__getOutboxForTests().length, 0); // หมด budget → drop
  });

  it("replay พังก่อนครบ budget → ยังอยู่ในคิวพร้อม attempts ที่เพิ่มขึ้น", async () => {
    enqueueOutbox(entry({ id: "x", row: { id: "x" } }));
    await flushOutbox(async () => false);

    const q = __getOutboxForTests();
    assert.equal(q.length, 1);
    assert.equal(q[0].attempts, 1);
  });

  it("replay โยน exception → ถือเป็นความพัง flush ไม่พังตาม", async () => {
    enqueueOutbox(entry({ id: "x", row: { id: "x" } }));
    await flushOutbox(async () => {
      throw new Error("network down");
    });
    const q = __getOutboxForTests();
    assert.equal(q.length, 1);
    assert.equal(q[0].attempts, 1);
  });

  it("พังสอง window แล้วสำเร็จ → หายจากคิวใน window ที่สาม", async () => {
    enqueueOutbox(entry({ id: "x", row: { id: "x" } }));

    let calls = 0;
    const replay = async () => {
      calls += 1;
      return calls >= 3;
    };

    await flushOutbox(replay);
    assert.equal(__getOutboxForTests()[0].attempts, 1);

    await flushOutbox(replay);
    assert.equal(__getOutboxForTests()[0].attempts, 2);

    await flushOutbox(replay);
    assert.equal(__getOutboxForTests().length, 0);
    assert.equal(calls, 3);
  });

  it("คิวว่าง → flush เงียบ ไม่เรียก replay", async () => {
    let calls = 0;
    await flushOutbox(async () => {
      calls += 1;
      return true;
    });
    assert.equal(calls, 0);
  });

  it("พังที่หัวคิว → หยุดพาสนั้น รายการหลังไม่เสีย budget ในเวลาเดียวกัน", async () => {
    enqueueOutbox(entry({ id: "head", row: { id: "head" } }));
    enqueueOutbox(entry({ id: "tail", row: { id: "tail" } }));

    const played: string[] = [];
    await flushOutbox(async (e) => {
      played.push(e.id);
      return e.id !== "head"; // หัวคิวพัง
    });

    assert.deepEqual(played, ["head"]); // หยุดทันที tail ยังไม่ถูกแตะ
    const q = __getOutboxForTests();
    assert.equal(q.length, 2);
    assert.equal(q[0].id, "head");
    assert.equal(q[0].attempts, 1);
    assert.equal(q[1].id, "tail");
    assert.equal(q[1].attempts, 0);
  });
});
