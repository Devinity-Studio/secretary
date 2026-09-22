/**
 * Speech state machine tests — กรณีทดสอบภาษาไทยตามธรรมเนียมของ repo
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  accumulateRecognitionText,
  initialSpeechState,
  speechErrorMessage,
  speechTransition,
} from "./speech.ts";

describe("Speech state machine — สถานะไมโครโฟน", () => {
  it("เริ่มฟัง: idle → listening และล้าง transcript/error เดิม", () => {
    const dirty = speechTransition(initialSpeechState, {
      type: "ERROR",
      message: "เก่า",
    });
    const next = speechTransition(dirty, { type: "START" });

    assert.equal(next.status, "listening");
    assert.equal(next.transcript, "");
    assert.equal(next.error, null);
  });

  it("ระหว่างฟัง: PARTIAL อัปเดต transcript แบบ interim", () => {
    const listening = speechTransition(initialSpeechState, { type: "START" });
    const next = speechTransition(listening, {
      type: "PARTIAL",
      transcript: "พรุ่งนี้",
    });

    assert.equal(next.status, "listening");
    assert.equal(next.transcript, "พรุ่งนี้");
  });

  it("กดหยุด: listening → transcribing (รอผลสุดท้าย)", () => {
    const listening = speechTransition(initialSpeechState, { type: "START" });
    const next = speechTransition(listening, { type: "STOP_REQUESTED" });

    assert.equal(next.status, "transcribing");
  });

  it("ได้ผลสุดท้าย: transcribing → done พร้อม transcript ที่ถอดได้", () => {
    let state = speechTransition(initialSpeechState, { type: "START" });
    state = speechTransition(state, { type: "PARTIAL", transcript: "เอาเอกสารไปส่ง" });
    state = speechTransition(state, { type: "STOP_REQUESTED" });
    state = speechTransition(state, { type: "FINAL", transcript: "เอาเอกสารไปส่ง" });

    assert.equal(state.status, "done");
    assert.equal(state.transcript, "เอาเอกสารไปส่ง");
  });

  it("จบเองโดยไม่กดหยุด: listening → done ได้เช่นกัน", () => {
    const listening = speechTransition(initialSpeechState, { type: "START" });
    const next = speechTransition(listening, { type: "FINAL", transcript: "จบเอง" });

    assert.equal(next.status, "done");
    assert.equal(next.transcript, "จบเอง");
  });

  it("PARTIAL หลังหยุดฟังแล้วไม่มีผล (กันผลช้าที่หลุดมา)", () => {
    let state = speechTransition(initialSpeechState, { type: "START" });
    state = speechTransition(state, { type: "STOP_REQUESTED" });
    const next = speechTransition(state, { type: "PARTIAL", transcript: "ช้า" });

    assert.equal(next, state);
    assert.equal(next.transcript, "");
  });

  it("FINAL จาก idle/done ไม่เปลี่ยนสถานะ", () => {
    const fromIdle = speechTransition(initialSpeechState, {
      type: "FINAL",
      transcript: "x",
    });
    assert.equal(fromIdle, initialSpeechState);

    const done = speechTransition(
      speechTransition(initialSpeechState, { type: "START" }),
      { type: "FINAL", transcript: "ครั้งแรก" },
    );
    const again = speechTransition(done, { type: "FINAL", transcript: "ครั้งสอง" });
    assert.equal(again, done);
  });

  it("ERROR เก็บ transcript เดิมไว้ให้ผู้ใช้ยังอ่าน/ก๊อปได้", () => {
    let state = speechTransition(initialSpeechState, { type: "START" });
    state = speechTransition(state, { type: "PARTIAL", transcript: "ฟังได้ครึ่ง" });
    const next = speechTransition(state, { type: "ERROR", message: "network" });

    assert.equal(next.status, "error");
    assert.equal(next.error, "network");
    assert.equal(next.transcript, "ฟังได้ครึ่ง");
  });

  it("RESET กลับสู่ค่าเริ่มต้นเสมอ", () => {
    let state = speechTransition(initialSpeechState, { type: "START" });
    state = speechTransition(state, { type: "PARTIAL", transcript: "อะไรบางอย่าง" });
    const next = speechTransition(state, { type: "RESET" });

    assert.deepEqual(next, initialSpeechState);
  });
});

describe("accumulateRecognitionText — รวมผล interim/final ไม่ให้ซ้ำกันเอง", () => {
  it("partial ตามด้วย final ของประโยคเดียวกัน → ได้ข้อความเดียว ไม่ซ้ำ", () => {
    // รอบแรก: interim "นัดหมอสัปดาห์หน้า" (ยังไม่ final)
    const first = accumulateRecognitionText("", [
      { isFinal: false, text: "นัดหมอสัปดาห์หน้า" },
    ]);
    assert.deepEqual(first, { committed: "", draft: "นัดหมอสัปดาห์หน้า" });

    // รอบสอง: engine ยืนยัน final ของสล็อตเดิม
    const second = accumulateRecognitionText(first.committed, [
      { isFinal: true, text: "นัดหมอสัปดาห์หน้า" },
    ]);
    assert.deepEqual(second, { committed: "นัดหมอสัปดาห์หน้า", draft: "" });
  });

  it("final ใหม่ต่อท้าย committed เดิมคั่นด้วยช่องว่าง", () => {
    const once = accumulateRecognitionText("", [{ isFinal: true, text: "ประโยคแรก" }]);
    const twice = accumulateRecognitionText(once.committed, [
      { isFinal: true, text: "ประโยคที่สอง" },
    ]);
    assert.equal(twice.committed, "ประโยคแรก ประโยคที่สอง");
  });

  it("final กับ interim มาใน event เดียว → ทั้งคู่ถูกนับ คนละส่วนกัน", () => {
    const result = accumulateRecognitionText("", [
      { isFinal: true, text: "ส่วนที่จบแล้ว" },
      { isFinal: false, text: "ส่วนที่กำลังพูด" },
    ]);
    assert.deepEqual(result, {
      committed: "ส่วนที่จบแล้ว",
      draft: "ส่วนที่กำลังพูด",
    });
  });

  it("interim รอบใหม่แทนที่ draft เดิม (engine พิมพ์ทับเสมอ)", () => {
    const first = accumulateRecognitionText("", [{ isFinal: false, text: "กำลัง" }]);
    const second = accumulateRecognitionText(first.committed, [
      { isFinal: false, text: "กำลังพูดต่อ" },
    ]);
    assert.deepEqual(second, { committed: "", draft: "กำลังพูดต่อ" });
  });

  it("ข้อความว่าง/ช่องว่างถูกข้าม — ไม่เกิดช่องว่างซ้ำซ้อน", () => {
    const result = accumulateRecognitionText("ส่วนเดิม", [
      { isFinal: false, text: "   " },
      { isFinal: true, text: "ใหม่" },
    ]);
    assert.deepEqual(result, { committed: "ส่วนเดิม ใหม่", draft: "" });
  });
});

describe("speechErrorMessage — ข้อความ error อ่านง่าย", () => {
  it("แจ้งเมื่อเบราว์เซอร์ไม่รองรับ", () => {
    const msg = speechErrorMessage(undefined, true);
    assert.match(msg, /ไม่รองรับ/);
  });

  it("แจ้งเรื่องสิทธิ์ไมโครโฟนเมื่อโดนปฏิเสธ", () => {
    assert.match(speechErrorMessage("not-allowed"), /อนุญาต|สิทธิ์/);
    assert.match(speechErrorMessage("service-not-allowed"), /อนุญาต|สิทธิ์/);
  });

  it("แจ้งเมื่อไม่มีเสียง / ไม่เจอไมค์ / เน็ตหลุด", () => {
    assert.match(speechErrorMessage("no-speech"), /ไม่ได้ยิน/);
    assert.match(speechErrorMessage("audio-capture"), /ไมโครโฟน/);
    assert.match(speechErrorMessage("network"), /เครือข่าย/);
  });

  it("มีข้อความกลางสำหรับโค้ดที่ไม่รู้จัก", () => {
    assert.match(speechErrorMessage("weird-code"), /ลองใหม่/);
  });
});
