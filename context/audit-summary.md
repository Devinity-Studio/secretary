# Context Integrity Audit — Summary

สรุปการสอดคล้องระหว่างไฟล์ที่สร้างเมื่อวันนี้กับ:
- **SECRETARY-ARCHITECTURE.md** (expected design contract)
- **AUDIT-GAP-ANALYSIS.md** (เดิมเขียนว่า gap ยังเหลือ — ควรปิดได้หรือยัง)

ฐานข้อมูลชุดกรณีทดสอบ: `context.test.ts`

| ผลลัพย์ | จำนวนรายการ |
|---------|--------------|
| ✅ ผ่าน | 7 |
| 🟡 ต้องปรับ | 2 |
| 🔴 ขาด | 0 |
| ⚠️ มี architectural risk | 0 |

---

## ✅ ผ่าน

### 5.1 Context เป็น domain model ที่ไม่ขึ้นกับ UI
- **เหตุผล:** `SecretaryContext` ไม่มีเมธอด nor ฟิลด์ที่ tie กับ view — UI สร้าง Statement จาก Facts ภายนอก model
- **อ้างอิง:** SECRETARY-ARCHITECTURE.md §5 “Universal Primitive … UI is a VIEWER of Context, not the model itself”
- **หมายเหตุ:** ข้อนี้ถูกนับเป็น “ผ่าน” ใน audit แม้ว่าเราจะยังไม่ได้เขียน component ContextCard — เพราะ model ไม่ได้ผูกติดกับ UI และอนุญาตให้สร้าง Statement จาก Facts ได้โดยไม่ต้องมี card component ก่อนก็ได้
- **สิ่งที่ยังขาด:** ContextCard component (ยังไม่เขียน)

### 6.1 สร้างได้ทันทีด้วย evidence = Record First
- **เหตุผล:** `CreateContextInput` ไม่บังคับ type / source / lifecycle; `createContext()` สร้างได้ด้วย evidence อย่างเดียว
- **อ้างอิง:** SECRETARY-ARCHITECTURE.md §6 “Record First, Identify Later”; AUDIT-GAP-ANALYSIS.md §2.1 Context Model gap เดิม

### 24.1 Fact เพิ่มได้จาก evidence โดยตรง (ต้องตรวจสอบ existence)
- **เหตุผล:** `addFact` ตรวจสอบว่า `evidenceIds` ที่อ้างจริงอยู่ใน store ก่อนอนุญาต
- **อ้างอิง:** SECRETARY-ARCHITECTURE.md §24 “Source of Truth ต้องแยกจาก AI Interpretation”; AUDIT-GAP-ANALYSIS.md §2.1 Evidence System (เดิม 🟡 มี confidence บน capture แต่ไม่มี Evidence type)

### 24.2 Inference ไม่เขียนทับ Fact — ต้องผ่าน confirm/reject
- **เหตุผล:** `addInference` บันทึก inference แยกจาก facts; ยังไม่แปลงเป็น fact จนกว่าจะ confirm
- **อ้างอิง:** SECRETARY-ARCHITECTURE.md §24; AUDIT-GAP-ANALYSIS.md §2.1 Evidence System

### 25.1 หลาย source เก็บเป็น evidenceIDs ใต้ context เดียวได้
- **เหตุผล:** `addEvidence` ขยาย `evidenceIds` + `sources` ได้หลายชั้น
- **อ้างอิง:** SECRETARY-ARCHITECTURE.md §25 “หลาย Source สามารถอ้างถึงเหตุการณ์เดียวกัน”

### 2.1.4 มี Entity Link (person/account/project/…)
- **เหตุผล:** `addLink` + `EntityLink` ครอบคลุม person/account/project/goal/document/conversation/context
- **อ้างอิง:** AUDIT-GAP-ANALYSIS.md §2.1 Context Linking (เดิม 🔴)

### 2.1 Evidence System — Evidence / Fact / Inference แยกชัดแล้ว
- **เหตุผล:** Evidence immutably stored; Fact trace ไป `evidenceIds`; Inference trace ไป `evidenceIds/factIds` — ไม่สับสนกับ parsed-capture confidence เดิม
- **อ้างอิง:** AUDIT-GAP-ANALYSIS.md §2.1 Evidence System (เดิม 🟡)



---

## 🟡 ต้องปรับ

### 9.1 judgment boundary ใน store
- **เหตุผล:** มีการเพิ่ม `RecordIntent` + `RecordBoundary` types, helper `isPatternRecord`/`isJudgmentRecord`, และ policy helpers `markPatternOnly`/`isPatternOnly`/`clearPatternOnly` ใน store — เห็นเส้นแบ่งระหว่าง pattern-only record กับ judgment แล้ว
- **อ้างอิง:** SECRETARY-ARCHITECTURE.md §9 “Observed Behavior ≠ Judgement”
- **หมายเหตุ:** ยังไม่ผสานกับ capture flow จริง — ยังเป็น manual flag / helper ที่ใช้ได้เมื่อต้องการ; ยังไม่มีกรณีทดสอบสำหรับ boundary logic ใหม่ (จัดอยู่ใน 🟡 9.1)
- **สถานะ:** 🟡 ต้องปรับ — เส้นแบ่งมีแล้ว แต่การใช้งานเชิงปฏิบัติยังไม่ผสานกับ capture flow จริง — ให้ทำ step 2 ต่อ

### 9.2 policy helper ใน store
- **เหตุผล:** เพิ่ม `markPatternOnly` / `isPatternOnly` / `clearPatternOnly` ใน store เพื่อทำเครื่องหมาย context ที่เป็น pattern-only
- **อ้างอิง:** context/next-steps/spec-capture-to-context.md §1
- **หมายเหตุ:** ยังไม่มี cases ทดสอบสำหรับ helper เหล่านี้ใน audit test suite — จัดอยู่ใน 🟡 9.2

### 9.2 policy helper ใน store
- **เหตุผล:** เพิ่ม `markPatternOnly` / `isPatternOnly` / `clearPatternOnly` ใน store เพื่อทำเครื่องหมาย context ที่เป็น pattern-only
- **อ้างอิง:** context/next-steps/spec-capture-to-context.md §1
- **หมายเหตุ:** ยังไม่มี cases ทดสอบสำหรับ helper เหล่านี้ใน audit test suite — จัดอยู่ใน 🟡 9.2

### 2.4 Glue code เชื่อม CaptureBar → addContext ยังไม่เขียน
- **เหตุผล:** ไฟล์ context/store สามารถสร้าง context จาก evidence ได้แล้ว แต่ยังไม่มีการเรียกใช้จริงจาก capture-bar
- **สิ่งที่ควรทำ:** เพิ่ม integration point ใน capture flow ที่ไปเรียก `createContext` + `addEvidence/AddFact` — ดูแผนใน `context/next-steps/spec-capture-to-context.md` §2 + flow ใน `context/next-steps/capture-to-context-flow.md`
- **อ้างอิง:** AUDIT-GAP-ANALYSIS.md §2.4 “Capture Bar — Quick capture with NLP parsing (เดิม ✅)”; §2.1 “Record First, Identify Later”
- **สถานะ:** 🟡 ต้องปรับ — ให้ทำ step 2 เสียก่อน เป็น vertical slice จริง

---

## 🔴 ขาด

ไม่มีรายการขาดใน scope ของ audit ชุดนี้ — เพราะไฟล์ที่เราเขียนครอบคลุม definition-of-done ของ gap 2.1 Context Model และ 2.1 Evidence System แล้ว.

อย่างไรก็ตาม:
- **Context Card / Statement View / Detail Panel** — ยัง ❌ ไม่เขียน component ไหนเลย
- **Workspace / panels / inertia / dynamic workspace** — ยัง ❌ ไม่เขียน
- **Memory / Relationship / Notification / Relevance / Voice / S2S** — ยัง ❌ ไม่เขียน

รายการเหล่านี้ไม่ได้อยู่ใน scope ของไฟล์ `src/lib/context/types.ts` + `src/lib/context/store.ts` — อยู่ในขั้นต่อไปของ roadmap (Phase 1.2 / Phase 2 / Phase 3)

---

## ⚠️ มี architectural risk

ไม่มีรายการ risk ในชุดไฟล์ชุดนี้.

หมายเหตุ: ไฟล์ `src/lib/context/store.ts` ยังไม่ได้ผูกกับระบบภายนอก (Supabase / sync) — นี่เป็นขั้นตอนต่อไป ไม่ใช่ risk ที่มีอยู่ตอนนี้.

---

## ข้อสังเกตเพิ่ม (เฉพาะ audit คนภายในทีม)

1. **Definition-of-done จาก Step 1.1 ใน roadmap ปิดได้แล้ว** — audit นี้ยืนยันว่า Context Type + Store ครอบคลุมสิ่งที่เขียนไว้แล้ว: create ด้วย evidence อย่างเดียว, lifecycle แยก history, evidence/fact/inference แยก, link entity, related contexts
2. **Audit เดิมเขียนว่า “2.1 Evidence System — 🟡”** — ตอนนี้ปิดแล้วเพราะมี Evidence type + Fact/Inference separation
3. **Audit เดิมเขียนว่า “2.1 Context Model — 🔴” + “Context Linking — 🔴”** — ตอนนี้ปิดแล้วเพราะมี SecretaryContext + link engine
4. **ส่วนที่เหลือใน roadmap** ยังวงกว้าง — ไม่ควรฝากเป็น “ปิดทุกอย่างในไฟล์นี้” เพราะมันครอบคลุมแค่ core domain model เท่านั้น
