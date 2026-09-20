# Rationale — ทำไมเราจัดวางไฟล์แบบนี้

## ทำไม `src/lib/context/audit-summary.md` อยู่ใน `src/lib/context/`?

1. **ใกล้ artifacts ที่ถูก audit มากที่สุด** — `types.ts`, `store.ts`, `audit-summary.md` อยู่ด้วยกัน จะได้ไม่กระจาย
2. **อ่านควบคู่กับไฟล์ context engineering** — คนมาดู context engine จะเห็น summary แนบอยู่ข้างใน folder เดียวกัน
3. **ไม่ปนเปื้อน docs/** — `docs/` เป็นเอกสารสถาปัตยกรรมระดับผลิตภัณฑ์ ไม่ใช่ engineering audit ย่อย — จะไม่ปนอยู่ใน doc tree เดียวกัน

## ทำไมสร้างไฟล์ทดสอบชื่อ `context.test.ts` ข้าง root?

1. **ตรงกับชื่อฟอลเดอร์ context** — ไฟล์อยู่ข้าง root จะเห็นเป็นหน่วยทดสอบชุดเดียวสำหรับ context module ทั้งหมด — `src/lib/context/types.ts`, `src/lib/context/store.ts`
2. **ไม่ต้องสร้าง nested folder ใหม่** — เพียงแค่ขยาย audit ให้เป็น executable test suite
3. **ชื่อไฟล์ชัดเจนว่าเป็น audit** — ไม่ใช่ unit test ปกติสำหรับ function เดียว แต่เป็นชุดทดสอบความสอดคล้องทางสถาปัตยกรรม

ข้อตกลง: ถ้ามีการเพิ่ม context module อื่นในอนาคต (เช่น memory, relationship), เราจะวาง test suite ใหม่ในลักษณะเดียวกันหรือรวมเข้าที่เดียวกัน.

## ทำไมใช้ fixture helper ส่วนตัวในไฟล์ทดสอบ?

เพราะต้องการให้แต่ละกรณีทดสอบสร้าง context/evidence/fact/inference ขึ้นมาจาก store จริง — ไม่ได้ mock ข้อมูล — เพื่อให้ audit นี้ตรวจความสอดคล้องจริงของ implementation.

---

นี่คือเหตุผล — อ่านประกอบกับ `context/audit-summary.md` และ `context.test.ts`
