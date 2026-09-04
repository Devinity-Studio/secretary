# คุณเลขา (Secretary) — สรุปความคืบหน้า และแพลนงาน

> ใช้เอกสารนี้เป็นจุดเริ่มต้นทุกครั้งที่กลับมาทำงานต่อ  
> อัปเดตล่าสุด: 5 กันยายน 2026

---

## 1. สรุปสถานะปัจจุบัน

| หัวข้อ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| เอกสารวางแผนทั้งหมด | ✅ เสร็จ | ไฟล์ 00–14 ใน `docs/` |
| เว็บแอป (dev + production build) | ✅ ใช้งานได้ | ผ่าน typecheck + browser QA |
| Quick Capture + Finance CRUD | ✅ เสร็จ | รายรับ/รายจ่าย/โอน, แก้ไข, ลบ |
| Goals (เป้าหมาย + contribution) | ✅ เสร็จ | สร้างเป้า, เพิ่มยอด, progress bar |
| ปฏิทิน + นัดหมาย + วันลา | ✅ เสร็จ | Month grid, day detail, event CRUD |
| Supabase sync (เบื้องต้น) | ✅ เสร็จ | Schema + RLS + write-through sync |
| Dark mode | ❌ ยังไม่ทำ | — |
| โค้ด Expo (`artifacts/mobile/`) | 🟡 โครง | tabs, guest auth, SQLite schema |
| Shared / เชิญครอบครัว | ❌ ยังไม่ทำ | — |
| Desktop reporting / โปรดักต์ | ❌ ยังไม่ทำ | ส่วนที่ 2 |

**ทิศทางที่ล็อกไว้:**

| ส่วน | ขอบเขต | ผู้ใช้ | สถานะ |
|------|--------|--------|--------|
| **ส่วนที่ 1 — ใช้เอง / วงใกล้** | มือถือ + การเงิน + Goal + ปฏิทิน + แชร์ในกลุ่ม | ผม, แฟน, ลูก, พี่น้อง, เพื่อน, องค์กร | ← **โฟกัส** |
| **ส่วนที่ 2 — ต่อยอดโปรดักต์** | เปิดสาธารณะ, store, สมาชิก | ผู้ใช้ทั่วไป | ทีหลัง |

---

## 2. สิ่งที่ทำเสร็จแล้ว (5 ก.ย. 2026)

### Phase 2 — Quick Capture + Finance + Goals + Calendar ✅

- Quick Capture: พิมพ์คำสั้น ๆ แล้วบันทึก (กาแฟ 65, เงินเดือน 28000, โอนออม 5000)
- Finance CRUD: รายรับ / รายจ่าย / โอนข้ามบัญชี, แก้ไข, ลบ
- หลายบัญชี: เงินสด, ธนาคาร, บัตรเครดิต, e-Wallet, ออม
- สรุปวันนี้ / สัปดาห์ / เดือน / ปี
- Goals: สร้างเป้าหมาย (ออมเงิน/นับวัน/ทั่วไป), เพิ่มยอด contribution, progress bar
- ปฏิทิน: Month grid, day detail, CRUD นัดหมาย/วันลา/เตือนความจำ
- ข้อมูลเก็บในเครื่อง (localStorage)

### Phase 3 — Supabase Sync ✅ (เบื้องต้น)

- Database schema: 5 ตาราง (accounts, transactions, goals, contributions, calendar_events) + RLS + triggers
- Sync service (`src/lib/supabase/sync.ts`): pull/push/delete สำหรับทุกตาราง
- Write-through sync: ทุก mutation เขียนทั้ง localStorage + Supabase (fire-and-forget)
- Login sync (`useSyncOnLogin`): ดึงข้อมูลจาก Supabase เมื่อ login, push ข้อมูลท้องถิ่นถ้า remote ว่าง
- ผ่าน E2E browser test: สร้าง goal → เพิ่มยอด 2 ครั้ง → ตรวจสอบ progress → ทดสอบ data persistence

### Fix & Polish

- แก้ `startup.sh` ให้ใช้ project root แทน hardcoded `/workspace`
- แก้ typecheck errors: better-auth truncated types, kysely missing declarations, PGLiteConnection type
- ผ่าน production build (`npm run build`) + browser QA (desktop + mobile)

---

## 3. งานถัดไปในส่วนที่ 1

1. **Dark mode** — Tailwind theme switching
2. **Shared ในวงใกล้** — บัญชีร่วม / เชิญครอบครัว
3. **Offline-first polish** — conflict resolution, background sync

---

## 4. เมื่อกลับมาครั้งหน้า

อ่านเอกสารนี้ แล้วเลือกทำต่อจากข้อ 3 ด้านบน
