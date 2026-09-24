# Secretary — Session Handoff (24 September 2026)

> เอกสารส่งต่อสำหรับ conversation ถัดไป — อ่านก่อนเริ่มทำอะไร
> กติกาที่ทีมยึด: **Reconcile → Foundation → Vertical Slice → Evidence → ค่อยขยาย**

---

## 1. Current State (ตอนจบ session)

| รายการ | สถานะ |
|---|---|
| Branch | `preview` — **pushed ครบแล้ว** ที่ `origin/preview` (Devinity-Studio/secretary) |
| Commit ล่าสุด | `7a01bd2` — fix(migrations): idempotent 0002/0004 + PGLite regression tests + realtime runbook |
| Working tree | tracked files **สะอาด** (untracked เหลือเฉพาะ screenshots/.docx/.freebuff — ตั้งใจไม่ commit) |
| Dev server | `startup.sh` → `npm run dev` บน `0.0.0.0:8080` |
| Built preview | `npm run preview` บน `127.0.0.1:8081` (รันเองบน Windows ได้ — ดูบทเรียน §4) |

### Gate ทั้งหมด: PASSED ครบ

| Gate | สถานะ | Evidence |
|---|---|---|
| Cloud Realtime Gate | 🟢 | Replication UI เปิด 2 ตาราง → Oracle ✅×2 → real event ✅ |
| Context Card QA | 🟢 | 23/23 ทั้ง dev (:8080) และ built (:8081) |
| Realtime Regression | 🟢 | E2E 19/19 รวม H1/H2 ด้วย event จริง ทั้งสอง env |
| Dev/Built parity | 🟢 | ผลลัพธ์ตรงกันทุกข้อ |
| npm test | 🟢 | 203 pass (scripts 197 + 2 skip + src 104) |
| typecheck / build | 🟢 | ผ่านทั้งคู่ |

---

## 2. Verified Evidence (ห้ามทำซ้ำเว้นแต่มีเหตุผลใหม่)

- **Context sync ข้ามอุปกรณ์ทำงานจริง**: login → push → pull → LWW merge → RLS 3 กรณี (E1 anon, E2 scoping, E3 forged user_id โดนบล็อก 403) → outbox offline→online flush
- **Realtime H1**: อุปกรณ์สองเห็นบริบทใหม่ภายใน ~8 วินาที **โดยไม่ reload** (postgres_changes ผ่าน publication `supabase_realtime`)
- **Realtime H2**: soft-delete (PATCH `deleted_at` จากภายนอก) → การ์ดหายจากอีกอุปกรณ์เอง
- **Context Card UX 4 ขั้น**: อินพุต (พิมพ์/ไมค์) → การ์ด → ปัด/แก้ (+#แท็ก) → ยืนยัน — ทั้ง desktop 1280×800 และ mobile 390×844, console สะอาด, Finance store ไม่ถูกแตะ
- **Migration idempotency** (PGLite — Postgres จริง): apply + re-run ทุกไฟล์ผ่าน, สมาชิกเดิมของ publication รอด, RLS 7 ตาราง / 28 policies / 4 triggers ครบ (`scripts/migrations-idempotency.test.mjs`)

---

## 3. Cloud Lesson — ⚠️ สำคัญที่สุดของ session

> **"SQL Run succeeded" ≠ migration succeeded**

- รัน `migrations/0004_realtime_contexts.sql` ผ่าน **Supabase SQL Editor ไม่สำเร็จแบบเงียบ ๆ**: publication `supabase_realtime` เป็นของ role ภายในของ Supabase ผู้ใช้ทั่วไปเจอ `42501 must be owner of publication` และ DO block ในไฟล์จับไม่ได้ (จับแค่ duplicate_object/undefined_object)
- **ทางที่ใช้ได้จริง**: Dashboard → **Database → Replication → tab "Supabase Realtime"** → เปิด toggle `public.contexts` + `public.context_evidence` → Save (UI รันด้วยสิทธิ์ admin)
- **วิธี verify หลังแตะ publication (ทำเสมอ)**:
  1. Oracle (read-only): join postgres_changes ผ่าน WSS — ไม่อยู่ใน publication = server ส่ง system error `Unable to subscribe to changes...` กลับมา (ใช้ได้แม้ไม่มีสิทธิ์อ่าน catalog — PostgREST ไม่ expose `pg_publication*`)
  2. Probe event จริง: insert แถว probe → รอ INSERT event → ลบทิ้ง
  3. E2E เต็ม: `E2E_EXPECT_REALTIME=1 node scripts/context-sync-e2e.mjs http://127.0.0.1:8080/context-card-demo` — หมายเหตุ: E2E ตัวนี้ใช้หน้าแรกได้ ต่างจาก context-card-qa (ดู §5)
- runbook เต็มอยู่ใน `docs/CONTEXT-SYNC-ARCHITECTURE.md` หัวไฟล์

---

## 4. Windows Lesson (เครื่อง dev นี้เป็น Windows — Y:\DevProject\secretary-main)

- **`npm run preview:restart` ใช้ไม่ได้** — `scripts/preview.mjs` ตรวจ `/proc/self` แล้ว exit (`no /proc — this script only runs inside the sandbox`) เพราะเขียนไว้สำหรับ Linux sandbox
- **ทางแทนที่ใช้ได้จริง**: `npm run preview -- --host 127.0.0.1 --port 8081` (background) — `with-app-env.mjs` ผ่าน env ครบ และ spawn สำเร็จบน Windows
- ถ้าจะแก้ `preview.mjs` ให้ cross-platform ในอนาคต: ต้องหา port owner ด้วยวิธีอื่นแทน /proc (เช่น `netstat -ano` บน Windows) — ยังไม่จำเป็นจนกว่าจะรำคาญจริง

---

## 5. QA Lesson

- **`scripts/context-card-qa.mjs` ต้องยิง URL เต็ม `/context-card-demo`** — docstring ในไฟล์แนะนำผิด (`http://127.0.0.1:8080/`) ซึ่งเป็นหน้าแรก ไม่มีปุ่ม "พิมพ์บันทึก" → timeout เป็น QA invocation error ไม่ใช่บั๊กแอป
  - แก้ docstring ตอนไหนก็ได้ที่แตะไฟล์ (ยังไม่แก้ — รอบนี้ lock code)
- `scripts/context-sync-e2e.mjs` กลับใช้หน้าแรก (`/`) ได้ปกติ — สองสคริปต์คาดหวัง URL ต่างกัน
- วินัยที่ได้ผล: เจอ failure → **หยุด เก็บหลักฐาน วินิจฉัยก่อน** — อย่ารันซ้ำด้วยความหวังว่าผลจะเปลี่ยน

---

## 6. Next Starting Point (Session ถัดไป)

**เริ่มด้วย: Reconcile → อ่าน handoff นี้ → กำหนด Vertical Slice → Foundation check → Implement → Evidence**

- ❌ **ห้ามย้อนไปทำ Foundation ซ้ำ** (sync/realtime/migrations) เว้นแต่ Evidence ใหม่ชี้ว่ามีปัญหา — Gate ปิดด้วย event จริงแล้ว
- ❌ ห้าม seed `_migrations` บน cloud — ยังไม่ตัดสิน migration lifecycle; hardening ปัจจุบันรองรับทั้ง seed และ re-run อยู่แล้ว
- ⏭️ Slice ถัดไปคือ **Context → Share / Context View** — แต่**ยังไม่เลือก** Share Card (og.jpg) หรือหน้า /context จนกว่าจะตอบให้ได้ว่า: *User Journey ถัดไปคืออะไร และ Slice นี้จะพิสูจน์ User Value อะไร*
  - หลัก: "อย่าสร้างหน้าถัดไปเพราะหน้าถัดไปควรมี — สร้างเมื่อรู้ว่ามาจาก journey ไหน"
- 🧹 เก็บกวาดได้เมื่อสะดวก (ไม่เร่ง): docstring URL ผิดใน `context-card-qa.mjs`, screenshots กองใน untracked (พิจารณา .gitignore)

---

## 7. ไฟล์ที่เกี่ยวข้อง (map เร็ว)

| เรื่อง | ไฟล์ |
|---|---|
| Runbook publication + สถาปัตยกรรม sync | `docs/CONTEXT-SYNC-ARCHITECTURE.md` |
| Migration idempotency test | `scripts/migrations-idempotency.test.mjs` |
| E2E sync/realtime | `scripts/context-sync-e2e.mjs` |
| QA Context Card | `scripts/context-card-qa.mjs` |
| Realtime bridge | `src/lib/supabase/realtime.ts` + `use-context-realtime.ts` |
| Outbox retry | `src/lib/supabase/outbox.ts` |
| Context store (local-first) | `src/lib/context/store.ts` |
| Demo route | `src/routes/context-card-demo.tsx` |
