# Judgment Boundary — Checklist (Step 1)

อ่านควบคู่กับ `context/next-steps/spec-capture-to-context.md` §1 และ flow ใน `context/next-steps/capture-to-context-flow.md`

## สิ่งที่ต้องทำ

- [x] เพิ่ม `RecordIntent` + `RecordBoundary` types ใน `src/lib/context/types.ts`
- [x] เพิ่ม `isPatternRecord` / `isJudgmentRecord` helper
- [x] เพิ่ม policy helper ใน store:
  - [x] `markPatternOnly(contextId)`
  - [x] `isPatternOnly(contextId): boolean`
  - [x] `clearPatternOnly(contextId)`
- [ ] เขียนกรณีทดสอบสำหรับ boundary logic นี้ (ยังไม่ได้เขียน)
- [ ] อัปเดต audit สรุปว่าช่องว่างปิดแล้วบางส่วน (🟡 9.1 → 🟡 ที่ชัดเจนขึ้น)

## สิ่งที่ทำไปแล้ว

- เพิ่ม types + helper ใน `src/lib/context/types.ts`
- เพิ่ม policy helpers (`markPatternOnly`, `isPatternOnly`, `clearPatternOnly`) ใน `src/lib/context/store.ts`
- อัปเดต `context/audit-summary.md` ระบุสถานะปัจจุบัน

## สิ่งที่ยังเหลือ

- [ ] ยังไม่มีกรณีทดสอบสำหรับ boundary logic ใหม่นี้
- [ ] ยังไม่ได้ผสานกับ capture flow จริง (รออีก step 2)

## Acceptance Criteria (ยังไม่ครบถ้วน)

- [ ] มีเส้นแบ่งชัดเจนระหว่าง pattern-only record กับ judgment ใน model/store ✅ (ทำไปแล้ว)
- [ ] สามารถสร้าง record แบบ pattern-only โดยไม่ผ่านการประเมินค่า ⏳ (ยังไม่ผสานกับ input จริง)
- [ ] คนอ่าน store บอกได้ว่า record นี้เป็น pattern หรือ judgment ✅ (ทำไปแล้ว)
- [ ] มีกรณีทดสอบ覆盖 boundary logic นี้ ❌ (ยังไม่ได้เขียน)

## หมายเหตุ

หาก step นี้เสร็จแล้วเราจะย้ายไปที่ step 2 (Capture → Context vertical slice) ทันที

ไฟล์อ้างอิง:
- `src/lib/context/types.ts`
- `src/lib/context/store.ts`
- `context/next-steps/spec-capture-to-context.md`
- `context/audit-summary.md`

---

เขียนขึ้นเพื่อทีมใช้เช็กลิสต์ก่อนเริ่มลงมือ step 1 — อัปเดตสถานะล่าสุดเมื่อทำ types + store helpers เสร็จ
