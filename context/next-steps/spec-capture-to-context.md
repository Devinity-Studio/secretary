# Next Steps — จาก Audit สู่ Vertical Slice แรก

อ่านควบคู่กับ `context/audit-summary.md`, `src/lib/context/types.ts`, `src/lib/context/store.ts`

## จุดประสงค์

พิสูจน์ว่าสายงานนี้ปิดช่องว่างสถาปัตยกรรมได้จริงในแนวตั้ง:

```
User Input → Evidence → Context → Store → UI
```

**ไม่สร้าง feature เยอะ** — สร้างเส้นเลือดเส้นแรกให้ Secretary ได้ก่อน
ให้ได้ว่า “สิ่งที่ผู้ใช้ป้อนเข้ามา” สามารถกลายเป็น **Context ที่มีโครงสร้าง** และไหลต่อไปถึง UI ได้จริง

---

## 0. ข้อตกลงก่อนเริ่ม

- เราจะทำ **vertical slice เล็ก** ไม่ใช่สร้างระบบใหญ่
- เราจะไม่สร้าง Judgment Engine, Memory Engine, Relationship Engine, Relevance Engine ในขั้นนี้
- เราจะไม่เปลี่ยน capture-bar UI มากเกิน — เปลี่ยน “flow” ไม่ใช่ “รูปลักษณ์”
- เราจะใช้ contract ที่อยู่ใน `src/lib/context/types.ts` + `src/lib/context/store.ts` เป็นฐาน
- เราจะไม่เสียเวลาเขียน component สวยๆ ก่อน proof-of-flow

---

## 1. Judgment Boundary 🟡 — ปิดช่องว่างแบบเล็กที่สุดก่อน

### จุดประสงค์

ทำให้ store / model มี “เส้นแบ่ง” ชัดเจนระหว่าง:

- **pattern-only record**: บันทึกสิ่งที่ observe ได้ โดยไม่ตัดสิน
- **judgement / inference**: AI หรือระบบประเมินอะไรสักอย่าง — แยกออกจาก pattern

**ไม่ต้องสร้าง Judgment Engine ใหญ่** — แค่ทำให้ model + store ไม่สับสนระหว่างสองเรื่อง

### สิ่งที่ควรทำ (เล็ก)

1. **เพิ่มประเภท record ที่ชัดเจนใน model หรือ helper**
   - ตัวอย่างเช่น: `Observation` หรือ `PatternRecord` ที่ไม่ใช่ Fact, ไม่ใช่ Inference
   - หรือเพิ่ม flag บน Evidence ว่า “นี่คือ observation อย่างเดียว ไม่ใช่ fact yet”
   - ลักษณะสำคัญ: **บันทึกได้โดยไม่ต้องผ่านการประเมินค่า**

2. **เพิ่ม policy helper ใน store**
   - เช่น `isJudgmentBoundaryCrossed(ctx): boolean`
   - หรือ `canRecordPattern(ctx): boolean`
   - หรือ `separatePatternFromInference(ctx): ...`
   - จุดประสงค์: **ให้คนที่อ่าน store บอกได้ว่า record นี้เป็น pattern หรือ judgement**

3. **อัปเดต audit สรุปว่าช่องว่างนี้ปิดแล้ว**
   - แก้ `context/audit-summary.md` ในส่วน 🟡 9.1 เป็น ✅/🟡 ที่ชัดเจนขึ้นหลังทำ step นี้

### สิ่งที่ห้ามทำใน step นี้

- ห้ามสร้าง engine ใหญ่จัดการ judgement ทั้งระบบ
- ห้ามเพิ่ม inference/persuasion logic ก่อนมี line แรกผ่าน
- ห้ามเปลี่ยนประเภท confidence หรือ source system เดิมแรงๆ

### Definition of Done

- [ ] มี boundary ชัดเจนใน model/store ว่าอะไรคือ pattern vs judgement
- [ ] สามารถสร้าง record แบบ pattern-only โดยไม่ต้องมี inference
- [ ] audit สรุปว่าช่องว่างนี้ปิดแล้วหรือยัง (🟡 → ✅ / 🟡 ที่ชัดเจนขึ้น)

---

## 2. Capture → Context 🟡 — Vertical Slice จริง

### จุดประสงค์

พิสูจน์ว่า:

```
User input (text) → Evidence → Context → Store
```

ไหลได้จริง ไม่ใช่แค่ประเภทและ store อยู่คนละที่

### สิ่งที่ควรทำ

1. **สร้าง adaptation layer ระหว่าง finance parser และ context types**
   - `parseCapture()` อยู่ใน `src/lib/finance/parser.ts` — แปลงประโยคเป็น `ParsedCapture`
   - **ปรับ/ต่อ** ให้ `ParsedCapture` สามารถ ontvGenerates evidence + context ได้
   - อย่าเปลี่ยน parser ทั้งหมด — ใช้ existing parser เป็นจุดเริ่มต้น แล้วแปลงทีหลัง

2. **เพิ่ม integration function / hook ที่เชื่อม capture → context store**
   - เช่น `createContextFromCapture(parsed: ParsedCapture): SecretaryContext`
   - หรือ hook `useCaptureToContext(parsed)` ที่ไปเรียก store
   - หน้าที่หลัก: **สร้าง evidence จาก parsed, สร้าง context จาก evidence, บันทึกใน store**

3. **wire เข้า capture bar (หรือ route ที่เรียกใช้ capture bar)**
   - สามารถทำแบบ minimal: เปลี่ยน `commit()` ใน capture bar ให้เรียก createContext ด้วย
   - หรือทำเป็น route/component แยกที่พิสูจน์ flow
   - จุดเน้น: **พิสูจน์ว่าข้อมูลไหลเข้า store จริง** — ไม่ใช่แค่แสดงผล

4. **พิสูจน์ว่า evidence สร้าง context ได้จริง**
   - เขียน test หรือ manual proof ว่า:
     - input “กาแฟ 65” → evidence → context ที่มี evidenceIds, facts (ถ้ามี), sources
     - input “เงินเดือน 28000” → evidence → context (financial transaction type)

5. **อัปเดต audit**
   - แก้ `context/audit-summary.md` ในส่วน 🟡 2.4 — หาก flow จริงผ่านแล้วให้ปิด/เคลื่อนสาย

### Definition of Done

- [ ] User input → Evidence → Context → Store ไหลได้จริงอย่างน้อยหนึ่ง vertical slice
- [ ] มี evidence บันทึกใน store จากการ input จริง (ไม่ใช่ mock)
- [ ] capture bar หรือ route ที่เลือก สามารถสร้าง context ได้ (ไม่จำเป็นต้องสวย)
- [ ] audit อัปเดต

### สิ่งที่ควรระวัง

- อย่าทำให้ finance store เสีย
- อย่าเปลี่ยน capture bar UI มากเกิน — focus ที่ flow ไม่ใช่ UX
- อย่าเพิ่ม logic จัดประเภท/เชื่อมโยงขั้นสูงก่อน proof เส้นเลือดแรกผ่าน

---

## 3. ContextCard — เมื่อข้อมูลไหลแล้ว ค่อยสร้าง UI

### จุดประสงค์

เมื่อมี context จริงใน store → สร้าง UI ที่นำ context มาแสดง

### สิ่งที่ควรทำ

1. **สร้าง ContextCard component ขั้นต่ำ**
   - รับ `SecretaryContext` หรือ summary
   - แสดง: statement (จาก facts หรือ generated), source, confidence indicator
   - ยังไม่ต้อง complete ทุก level — ทำให้พอแสดง context จริงได้

2. **เชื่อม ContextCard กับ store**
   - นำข้อมูลจาก `useContextStore` / `useAllContexts` มาแสดง
   - พิสูจน์ว่า UI สามารถอ่าน model ได้จริง

3. **อาจต้องสร้าง derived statement helper**
   - เพราะ model ไม่มี statement เป็น field — ต้องสร้างจาก facts
   - helper นี้ควรอยู่ในระดับ UI / presentation, ไม่ใช่ model

### Definition of Done

- [ ] มี ContextCard ที่แสดง context จริงจาก store ได้
- [ ] พิสูจน์ว่า model → UI ทำงานได้ (ขั้นต่ำพอแสดงการไหล)

---

## 4. Workspace — ให้ Workspace เป็นพื้นที่ที่ “Context ปรากฏ” ไม่ใช่สร้าง model ใหม่

### จุดประสงค์

Workspace คือพื้นที่ที่ context ปรากฏ — ไม่ใช่สร้าง model ใหม่

### สิ่งที่ควรทำ

1. **วางพื้นที่ Workspace แบบ minimal ที่รองรับ context**
   - ไม่ต้องสร้าง panel ระบบใหญ่ทันที
   - สร้างพื้นที่ที่ context สามารถปรากฏได้
   - อาจใช้ react-resizable-panels ในภายหลัง — แต่ตอนนี้ focus ที่ “context ปรากฏได้”

2. **วาง ContextCard ลงใน Workspace**
   - ให้เห็นว่า context ไหลจาก input → store → card → workspace

### Definition of Done

- [ ] Workspace แสดง context ได้จริง (ผ่าน card หรือ component)
- [ ] พิสูจน์ว่า Workspace ไม่ใช่แค่สร้าง modelใหม่ แต่เป็นพื้นที่ปรากฏของ context

---

## สิ่งที่ไม่ทำในขั้นนี้ (โดยเจตนา)

- ไม่สร้าง Memory Engine / Relationship Engine / Relevance Engine
- ไม่สร้าง Notification Intelligence / Email Intelligence / S2S
- ไม่สร้าง voice / ambient interaction
- ไม่ build context card แบบ perfect — สร้างแบบพอทดสอบ flow
- ไม่ทำ dynamic workspace / inertia / cognitive mode ระดับสมบูรณ์

---

## ลำดับที่แนะนำ

```
1. Judgment Boundary (เล็ก)      → ปิดช่องว่าง model/store
2. Capture → Context vertical slice → พิสูจน์ flow จริง
3. ContextCard (ขั้นต่ำ)         → พิสูจน์ model → UI
4. Workspace minimal              → พิสูจน์ workspace = พื้นที่ context ปรากฏ
```

จุดเด่น: **ขั้น 2 เป็นจุดเปลี่ยน** — เมื่อนี่ผ่านแล้ว เรามีเส้นเลือดแล้ว เคสอื่นๆค่อยขยายจากมัน.

---

## อ้างอิงไฟล์ที่ควรแก้/เพิ่มในแต่ละ step

| Step | ไฟล์หลัก |
|------|----------|
| 1. Judgment Boundary | `src/lib/context/types.ts` (อาจเพิ่ม helper/policy types), `src/lib/context/store.ts` (policy logic), `context/audit-summary.md` (อัปเดต) |
| 2. Capture → Context | `src/lib/finance/parser.ts` (adapt), ไฟล์ integration ใหม่, `src/components/capture-bar.tsx` (wire), `context/audit-summary.md` (อัปเดต) |
| 3. ContextCard | ไฟล์ component ใหม่, derived statement helper |
| 4. Workspace | ไฟล์ workspace ใหม่, panel layout ขั้นต่ำ |

---

นี่คือแผนสำหรับทีม — ไม่ใช่โค้ด — ให้ใช้อ่านแล้วลงมือ implement ตามขอบเขตที่เขียนไว้
