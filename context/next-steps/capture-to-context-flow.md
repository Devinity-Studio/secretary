# Flow: เส้นเลือดแรกของ Secretary

```
User Input (text)
      ↓
CaptureBar (parseCapture)
      ↓
ParsedCapture  →  adaptation  →  Evidence
      ↓
createContext()        →  Context  (ใน store)
      ↓
ContextStore  ←  เส้นเลือดแรกเกิดขึ้น
      ↓
ContextCard  ←  นำ model จาก store มาแสดง
      ↓
Workspace  ←  พื้นที่ที่ context ปรากฏ
```

## รายละเอียดแต่ละจุด

### 1. User Input → CaptureBar
- ผู้ใช้พิมพ์ข้อความสั้น เช่น “กาแฟ 65”, “เงินเดือน 28000”
- CaptureBar อยู่ใน `src/components/capture-bar.tsx`
- มี `parseCapture()` จาก `src/lib/finance/parser.ts` แปลงเป็น `ParsedCapture`

### 2. ParsedCapture → Evidence
- adaptation layer แปลง `ParsedCapture` → `Evidence` (ตาม contract ใน `src/lib/context/types.ts`)
- evidence สร้างจากข้อมูลที่ parse ได้:
  - sourceType (อาจเป็น “user”)
  - content (text หรือ structured)
  - confidence (from parser หรือ mapping)
- **จุดนี้สำคัญ**: สร้าง evidence ได้จาก input จริง — ไม่ใช่ mock

### 3. Evidence → Context
- เรียก `createContext()` ใน `src/lib/context/store.ts` ด้วย evidence
- ได้ `SecretaryContext` ที่มี:
  - evidenceIds
  - facts (ถ้ามี)
  - inferences (ยังไม่มี)
  - lifecycle = tentative
  - primarySource + sources
- **จุดนี้สำคัญ**: context มีโครงสร้างตาม model ตั้งแต่ input

### 4. Context → Store
- context บันทึกใน Zustand store (`src/lib/context/store.ts`)
- เส้นเลือดแรกปิด: **input → evidence → context → store จริง**

### 5. Store → ContextCard
- ContextCard อ่านจาก store (เช่น `useAllContexts`, `useContext`)
- สร้าง statement จาก facts (หรือ generated)
- แสดง source, confidence indicator
- **จุดนี้สำคัญ**: model → UI ทำงานได้จริง

### 6. ContextCard → Workspace
- Workspace เป็นพื้นที่ที่จัดวาง ContextCard
- context ปรากฏใน workspace — ไม่ใช่สร้าง model ใหม่ใน workspace

---

## จุดที่พิสูจน์ได้

หลัง vertical slice นี้ผ่าน:

1. **ผู้ใช้ป้อนเข้ามา → กลายเป็น Context ที่มีโครงสร้างได้จริง**
2. **Context ไหลไปถึง UI ได้จริง**
3. **เราไม่ต้องสร้าง feature มาก — มีแค่เส้นเลือดที่ทำงาน**

---

## ไฟล์หลักที่เกี่ยวข้อง

| จุด | ไฟล์ |
|-----|------|
| Input | `src/components/capture-bar.tsx` |
| Parse | `src/lib/finance/parser.ts` |
| Types | `src/lib/context/types.ts` |
| Store | `src/lib/context/store.ts` |
| Card (ขั้นต่อมา) | ไฟล์ component ใหม่ |
| Workspace (ขั้นต่อมา) | ไฟล์ workspace ใหม่ |

---

เขียนอ้างอิงสำหรับทีมเมื่อเริ่มลงมือทำ vertical slice
