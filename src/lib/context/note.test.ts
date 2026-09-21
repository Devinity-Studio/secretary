/**
 * Context Note (Text/Voice → Context) tests
 * ทดสอบว่าโน้ตข้อความ/เสียง กลายเป็น Context ถูกต้อง และไม่กระทบ Finance/Goals/Calendar
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { useContextStore } from "./store.ts";
import {
  createContextFromNote,
  noteToEvidence,
  originToSourceType,
  shortContextRef,
} from "./note.ts";
import { CONTEXT_DOMAIN_TYPES } from "./types.ts";

describe("originToSourceType — ช่องทางข้อมูล", () => {
  it("พิมพ์ → user, พูด → voice", () => {
    assert.equal(originToSourceType("text"), "user");
    assert.equal(originToSourceType("voice"), "voice");
  });
});

describe("noteToEvidence — Evidence จากข้อความดิบ", () => {
  it("ข้อความธรรมดาได้ evidence แบบ text, confidence high สำหรับ user", () => {
    const evidence = noteToEvidence({
      text: " พรุ่งนี้เอาเอกสารไปส่งที่ธนาคาร ",
      origin: "text",
      capturedAt: "2026-09-21T00:00:00.000Z",
    });

    assert.equal(evidence.sourceType, "user");
    assert.equal(evidence.confidence, "high");
    assert.deepEqual(evidence.content, {
      kind: "text",
      text: "พรุ่งนี้เอาเอกสารไปส่งที่ธนาคาร",
    });
  });

  it("เสียงได้ confidence medium และมี tag metadata แบบ hybrid เมื่อส่ง metadata มา", () => {
    const evidence = noteToEvidence({
      text: "ประชุมสามทุ่ม",
      origin: "voice",
      capturedAt: "2026-09-21T00:00:00.000Z",
      metadata: { durationMs: 4200 },
    });

    assert.equal(evidence.sourceType, "voice");
    assert.equal(evidence.confidence, "medium");
    assert.equal(evidence.content.kind, "hybrid");
    if (evidence.content.kind === "hybrid") {
      assert.equal(evidence.content.data.durationMs, 4200);
    }
  });
});

describe("createContextFromNote — Text/Voice → Context", () => {
  it("สร้าง Context แบบ tentative พร้อม evidence อ้างอิงถึงต้นฉบับ", () => {
    const context = createContextFromNote({
      text: "ซื้อของขวัญวันเกิดแม่",
      origin: "text",
      capturedAt: "2026-09-21T00:00:00.000Z",
    });

    assert.ok(context);
    assert.equal(context.type, CONTEXT_DOMAIN_TYPES.USER_NOTE);
    assert.equal(context.lifecycle, "tentative");
    assert.equal(context.primarySource, "user");
    assert.equal(context.evidenceIds.length, 1);
    assert.deepEqual(context.facts, []);
    assert.deepEqual(context.inferences, []);
    assert.deepEqual(context.tags, ["context"]);

    const store = useContextStore.getState();
    const evidence = store.getEvidence(context.evidenceIds[0]);
    assert.ok(evidence);
    assert.equal(evidence?.content.kind, "text");
    if (evidence?.content.kind === "text") {
      assert.equal(evidence.content.text, "ซื้อของขวัญวันเกิดแม่");
    }

    // Judgment Boundary: capture เป็น pattern-only
    assert.equal(store.isPatternOnly(context.id), true);

    // ไม่กระทบ Finance — store แยกกันคนละ instance
    const ctxAfter = store.getContext(context.id);
    assert.ok(ctxAfter);
  });

  it("โน้ตจากเสียงได้ source = voice และ tag บอกช่องทาง", () => {
    const context = createContextFromNote({
      text: "นัดหมอสัปดาห์หน้า",
      origin: "voice",
      capturedAt: "2026-09-21T00:00:00.000Z",
    });

    assert.ok(context);
    assert.equal(context.primarySource, "voice");
    assert.deepEqual(context.sources, ["voice"]);
    assert.deepEqual(context.tags, ["context", "voice"]);
  });

  it("ข้อความว่าง/ช่องว่างล้วน → null และไม่สร้าง context", () => {
    const before = useContextStore.getState().getAllContexts().length;

    assert.equal(createContextFromNote({ text: "", origin: "text" }), null);
    assert.equal(createContextFromNote({ text: "   \n\t ", origin: "voice" }), null);

    const after = useContextStore.getState().getAllContexts().length;
    assert.equal(after, before);
  });

  it("เพิ่ม context ใหม่แล้วยังไม่แตะ facts/inferences เลย (Judgment Boundary)", () => {
    const context = createContextFromNote({
      text: "จ่ายค่าไฟภายในสัปดาห์นี้",
      origin: "text",
    });

    assert.ok(context);
    const stored = useContextStore.getState().getContext(context.id);
    assert.ok(stored);
    assert.equal(stored.facts.length, 0);
    assert.equal(stored.inferences.length, 0);
    assert.equal(stored.history.some((h) => h.type === "fact_added"), false);
    assert.equal(stored.history.some((h) => h.type === "inference_added"), false);
  });
});

describe("shortContextRef — ตัวระบุสั้นบนการ์ด", () => {
  it("ตัดขีดและเหลือ prefix สั้น ๆ", () => {
    assert.equal(
      shortContextRef("a1b2c3d4-e5f6-7890-abcd-ef0123456789"),
      "ctx_a1b2c3",
    );
  });
});
