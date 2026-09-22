# Context Sync Architecture

**Purpose:** เอกสารอ้างอิงสถาปัตยกรรมการซิงก์ Context ระหว่างอุปกรณ์ (local-first + Supabase) สำหรับพัฒนาต่อ / debug / ขยาย sync ไปยัง store อื่น
**Status:** 🟢 IMPLEMENTED + VERIFIED (unit 99/99, E2E 19/19 บน dev และ production build — รวม outbox offline→online + realtime bridge; H1/H2 รอ apply publication 0004)
**Companion docs:** `SECRETARY-ARCHITECTURE.md` (Context Domain Model — Appendix A)
**Last Updated:** 22 September 2026

---

# 1. Executive Summary

Context store ซิงก์ข้ามอุปกรณ์ด้วยหลัก **local-first**:

> **localStorage คือ read path ทันที (offline-safe) — Supabase คือ durable backup + ตัวกลางข้ามอุปกรณ์**

- ทุก mutation commit ลง local ก่อน **แบบ synchronous** → UI ไม่เคยถูกบล็อกด้วยเครือข่าย
- Push ขึ้นคลาวด์แบบ fire-and-forget พร้อม **fail-loud toast** (ไม่มี error หลุดเงียบ)
- ตอน login: **pull → merge last-write-wins (LWW) บน `updatedAt` → push เวอร์ชันผู้ชนะกลับ**
- RLS ทุกตาราง scope ด้วย `auth.uid()` — client เป็น domain authority, server เป็นกำแพงกันข้าม user

```text
        ┌─────────────────────────────────────────────┐
        │                อุปกรณ์ใด ๆ                  │
        │                                             │
        │  UI ──mutation──▶ Zustand store             │
        │                     │                       │
        │              commit local (sync)            │
        │                     │                       │
        │                     ├──▶ localStorage       │  ◀── อ่านทันที / offline
        │                     │                       │
        │                     └──▶ push (async)       │
        └──────────────────────────┼──────────────────┘
                                   ▼
                    ┌──────────────────────────┐
                    │   Supabase (PostgREST)   │
                    │  contexts / context_     │
                    │  evidence + RLS          │
                    └──────────────────────────┘
                                   ▲
        ┌──────────────────────────┼──────────────────┐
        │  login บนอุปกรณ์ใหม่: pull → merge LWW →  │
        │  push เวอร์ชันผู้ชนะ → ทุกเครื่อง converge │
        └─────────────────────────────────────────────┘
```

---

# 2. ไฟล์ที่เกี่ยวข้อง (File Map)

| ไฟล์ | บทบาท |
|---|---|
| [migrations/0003_context_sync.sql](../migrations/0003_context_sync.sql) | ตาราง `contexts` + `context_evidence` + RLS (idempotent — รันซ้ำได้) |
| [migrations/0004_realtime_contexts.sql](../migrations/0004_realtime_contexts.sql) | เพิ่มสองตารางเข้า publication `supabase_realtime` (จำเป็นสำหรับ realtime — idempotent) |
| [src/lib/context/types.ts](../src/lib/context/types.ts) | Canonical domain types (`SecretaryContext`, `Evidence`, …) |
| [src/lib/context/store.ts](../src/lib/context/store.ts) | Zustand store — local-first + push wiring + `replaceAllFromSync` + Judgment Boundary API |
| [src/lib/supabase/sync.ts](../src/lib/supabase/sync.ts) | Mapper + push/pull/merge (`mergeContexts`) + `pushAllLocal` |
| [src/lib/supabase/use-sync-on-login.ts](../src/lib/supabase/use-sync-on-login.ts) | Login hook — pull → merge → push-back |
| [src/lib/supabase/sync-status.ts](../src/lib/supabase/sync-status.ts) | `notifyPushFailure` / `notifyPullFailure` / `notifyOutboxFlushed` / `notifyOutboxDropped` (toast throttle 60s) |
| [src/lib/supabase/outbox.ts](../src/lib/supabase/outbox.ts) | Outbox retry queue — persist push ที่พัง แล้วส่งใหม่เองเมื่อออนไลน์/visible/login |
| [src/lib/supabase/outbox.test.ts](../src/lib/supabase/outbox.test.ts) | Unit tests ของคิว — dedupe/FIFO/cap/persistence/attempt budget |
| [src/lib/supabase/realtime.ts](../src/lib/supabase/realtime.ts) | Realtime bridge — singleton channel + apply เข้า store + status getter |
| [src/lib/supabase/use-context-realtime.ts](../src/lib/supabase/use-context-realtime.ts) | Hook mount bridge — resubscribe ตาม session, unmount บน logout |
| [src/lib/supabase/context-sync.test.ts](../src/lib/supabase/context-sync.test.ts) | Unit tests — mapper roundtrip, null-safety, LWW ทุกทิศ |
| [scripts/context-sync-e2e.mjs](../scripts/context-sync-e2e.mjs) | E2E 12 ขั้น — login/push/pull/LWW/RLS (มี pre-migration resilience mode) |

---

# 3. Schema — [0003_context_sync.sql](../migrations/0003_context_sync.sql)

## 3.1 ตาราง

**`public.contexts`** — 1 แถวต่อ 1 Context

- `id text primary key` — client-generated (nanoid-style) ไม่ใช่ UUID
- `user_id uuid not null → auth.users(id) on delete cascade`
- คอลัมน์ scalar: `type`, `lifecycle`, `primary_source`, `created_by`, `expires_at`, `priority`, `archived`, `canonical_id`
- คอลัมน์ **jsonb** (โครงสร้างซ้อนของ domain): `evidence_ids`, `facts`, `inferences`, `sources`, `links`, `related_contexts`, `history`, `tags`, `shared_with_user_ids`
- Timestamps: `created_at`, `updated_at`, `deleted_at` (soft delete, NULL = active)
- Index: `contexts_user_idx on (user_id) where deleted_at is null`

**`public.context_evidence`** — แถว **immutable**

- `id text primary key`, `user_id uuid`, `source_type`, `source_id`, `content jsonb`, `captured_at`, `confidence`
- เขียนครั้งเดียว ไม่แก้ — upsert เป็น idempotent-noop โดยดีไซน์ (retried push / อีกเครื่อง push ซ้ำ = ไม่มีผล)

## 3.2 การตัดสินใจเชิงดีไซน์ที่สำคัญ (ห้ามลืม)

1. **ไม่มี trigger `updated_at` ฝั่ง server** — ต่างจากตารางชุด 0002 โดยเจตนา
   `updated_at` ของ client คือ **คีย์ตัดสิน LWW** ถ้า server แทนที่ด้วย `now()` ข้อมูลลำดับเวลาที่ merge อาศัยจะถูกลบทิ้ง
2. **jsonb แทนการกระจายเป็นตารางลูก** — browser คือ domain authority, client ส่งทั้งแถว ไม่ต้องมี relational decomposition
3. **Soft delete ด้วย `deleted_at`** — เครื่องอื่น pull แล้วเห็นการลบ (ไม่ใช่ row หายไปเฉย ๆ จน sync ไม่รู้เรื่อง)
4. **RLS ครบทุก action** (select/insert/update/delete × 2 ตาราง) — `using (auth.uid() = user_id)`; anon เห็น 0 แถว ไม่ใช่ error

---

# 4. Sync Layer (`src/lib/supabase/sync.ts`)

## 4.1 Mappers

`contextToRow` / `rowToContext` / `evidenceToRow` / `rowToEvidence` — แปลง camelCase ↔ snake_case **export ไว้ให้ unit test ใช้** (pure function ไม่แตะ client):

> กติกา: mapper ใหม่ทุกตัวต้อง pure และมี roundtrip test — ดู `context-sync.test.ts`

## 4.2 Push helpers (fire-and-forget)

```text
pushContext(c)              → upsert contexts
pushContextEvidence(e)      → upsert context_evidence (immutable, idempotent)
deleteContext(id)           → soft delete (update deleted_at)
pushAllLocal(SyncData)      → upsert ทุกตาราง (ใช้ตอน first-login / push-back)
```

**กฎเหล็ก: supabase-js รายงานความพังเป็น "ค่าที่ return" ไม่ใช่ throw** — ทุก helper ต้องเช็ค `error` แล้ว throw เอง ไม่งั้น push พลาดแบบเงียบและ `notifyPushFailure` ไม่มีวันทำงาน (เคยเป็น bug จริง — ดู §10)

## 4.3 `upsertWithFallback` — batch พังไม่ตายทั้งก้อน

PostgREST upsert **atomic** — แถวเดียวผิด constraint จมทั้ง batch จึงมี fallback:

```text
upsert ทั้งก้อน
  ├─ สำเร็จ → จบ
  └─ พัง → retry เป็น chunk ละ 25 แถว
            ├─ chunk ไหนผ่าน → ขึ้นคลาวด์ (healthy majority รอด)
            └─ chunk ไหนพัง → log + drop เฉพาะก้อนนั้น
```

ใช้กับ `pushAllLocal` ทุกตาราง และ `pushAllLocal` **แยกความพังรายตาราง** — ตารางไหน sync ไม่ได้ไม่หยุดตารางอื่น สุดท้าย throw aggregate เพื่อให้ caller แจ้ง toast

## 4.4 Pull — fail-loud ไม่มั่วว่า "remote ว่าง"

`pullAll()` ยิง 7 query พร้อมกัน (`Promise.all`) แล้วเช็ค error ทุก result:

> **pull พังต้อง return `null` ไม่ใช่ dataset ว่าง** — ถ้ามั่วว่า remote ว่างเมื่อจริงคือ network/schema พัง จะกลายเป็น overwrite ข้อมูลคลาวด์ด้วยของ local ทั้งก้อนตอน first-login (เคยเป็นช่องโหว่เงียบของชุดเดิม — แก้แล้วตาม comment ในไฟล์)

Caller (`useSyncOnLogin`) เจอ `null` → bail ทันที + toast

## 4.5 `mergeContexts` — Last-Write-Wins บน `updatedAt`

```text
mergeContexts(local, remoteContexts, remoteEvidence)
  → { contexts, evidence, toPush, evidenceToPush }
```

| กรณี | การตัดสิน |
|---|---|
| มีเฉพาะ remote | นำเข้า + นำ evidence ที่ยังไม่มีตามไปด้วย |
| มีทั้งสองฝั่ง | **ฝั่ง `updatedAt` ใหม่กว่าชนะ** |
| └ remote ชนะ | adopt evidence ของ remote (immutable ปลอดภัย) |
| └ local ชนะ | push กลับ (`toPush`) เพื่อให้เครื่องอื่น converge |
| มีเฉพาะ local | ถือเป็นแถวใหม่ → push ทั้ง context + evidence (`toPush`/`evidenceToPush`) |

ข้อจำกัดที่ยอมรับโดยดีไซน์: LWW ตัดสิน **ระดับแถว** ไม่ใช่ระดับ field — แก้สองฟิลด์บนสองเครื่องพร้อมกัน เครื่องที่ `updatedAt` ใหม่กว่าชนะทั้งแถว (history ในแถวยังเก็บ audit ไว้) เพียงพอสำหรับ usage pattern ปัจจุบัน

---

# 5. Login Flow (`use-sync-on-login.ts`)

```text
auth state → logged in
      ▼
pullAll()
      ▼
┌─ remote มีข้อมูล ────────────────────────────────────────────┐
│ • finance/goals/calendar → replaceAll (แบบเดิม)              │
│ • contexts → mergeContexts (LWW) → replaceAllFromSync        │
│   (preserve pattern-only flags — Judgment Boundary ไม่หาย)   │
│ • push กลับ: local winners + แถวใหม่ (batch เดียว,           │
│   fire-and-forget, รวม evidence ที่ยังไม่ขึ้นคลาวด์)          │
└──────────────────────────────────────────────────────────────┘
┌─ remote ว่าง + local มีข้อมูล (first login) ─────────────────┐
│ pushAllLocal ทุกตาราง รวม contexts + evidence                │
└──────────────────────────────────────────────────────────────┘
┌─ pull พัง (null) ────────────────────────────────────────────┐
│ toast แจ้ง + ทำอะไรต่อไม่ทำ — ข้อมูล local ปลอดภัย 100%       │
└──────────────────────────────────────────────────────────────┘
```

รายละเอียดที่ต้องรักษาตอนแก้:

- `hasSynced` ref กัน sync ซ้ำ + reset เมื่อ `onAuthStateChange` เจอ login ใหม่ (สลับ user ได้)
- push-back ใช้ `pushAllLocal` **batch เดียว** (ไม่ loop `pushContext` ทีละแถว)
- evidence ที่ push กลับ dedupe ด้วย `Map` ก่อนยิง

---

# 6. Store Wiring (`src/lib/context/store.ts`)

## 6.1 Sync bridge

ทุก mutation (create / archive / delete / lifecycle / evidence / fact / inference / link / related / type / priority / tag):

1. **commit local ก่อนเสมอ** (setState + persist) — อ่านไม่เคยโดนบล็อก
2. push fire-and-forget: `syncX(...).catch((err) => notifyPushFailure(err))`
3. push พัง → **toast throttle 60s** + **enqueue ลง outbox อัตโนมัติ** — แถวจะถูกส่งใหม่เองเมื่อกลับออนไลน์ (ดู §8)
   → retry ไม่ต้องพึ่ง mutation ถัดไปอีกแล้ว: outbox จัดการให้ทุกกรณี

## 6.2 Judgment Boundary — pattern-only flags

ธง `patternOnlyContextIds` คือผู้รักษาหลัก **"Observed Pattern ≠ Judgement"** (§9 ของ `SECRETARY-ARCHITECTURE.md`) — บริบทที่มาจาก pattern ที่สังเกตได้ต้องไม่ถูกตีความเป็นการตัดสินตัวตนผู้ใช้

- **State:** `patternOnlyContextIds: Set<string>` ใน store — **ไม่มีคอลัมน์บน DB โดยเจตนา** เป็นธงเชิงความหมายของอุปกรณ์นั้น ไม่ใช่ข้อมูล domain ที่ sync
- **API (ใน store):** `markPatternOnly(id)` / `isPatternOnly(id)` / `clearPatternOnly(id)` — ปัจจุบันยังไม่มี UI caller เตรียมไว้ให้ retrieval / capture layer
- **สัญญาทางสถาปัตยกรรม:** การ merge จากคลาวด์ **ต้องไม่ล้างธงเหล่านี้** — ไม่งั้นทุกครั้งที่ pull เส้นแบ่ง judgment จะถูกลบทิ้ง (และนี่คือเหตุผลที่ `replaceAllFromSync` แยกจาก `replaceAll`)

## 6.3 `replaceAllFromSync` — merge แบบไม่ลบ Judgment Boundary

Signature: `(contexts, evidence, keepPatternOnlyIds?)` — ต่างจาก `replaceAll` (ตั้ง `patternOnlyContextIds` เป็น Set ว่าง) ตรงที่ **คงธง pattern-only เดิม** เฉพาะ id ที่ยังมี context อยู่หลัง replace (ธงของแถวที่ถูกลบบนคลาวด์ระเหยไปตามแถว — ถูกต้อง) ใช้โดย `use-sync-on-login.ts` ตอน apply ผล LWW merge

Defensive: รับ `keepPatternOnlyIds` ที่ไม่ใช่ Set (persist ค้างจากเวอร์ชันเก่า) ได้โดยไม่ throw

## 6.4 Persistence — Set ไม่รอด JSON (bug ที่แก้แล้ว)

`patternOnlyContextIds` เป็น `Set<string>` ซึ่ง `JSON.stringify` ทำให้กลายเป็น `{}` — หลัง rehydrate จึงพังสองทาง: โค้ดที่ iterate ตรง ๆ เดินผิด และ **flag หายทุก reload**

แก้ที่รากด้วย zustand persist (ท้าย `store.ts`):

```ts
partialize: (state) => ({ ...state, patternOnlyContextIds: Array.from(...) })
merge: (persisted, current) => ({ ..., patternOnlyContextIds: new Set(...) })
```

รวมกับ defensive guard ใน §6.3 — เวอร์ชันเก่า (persist `{}` ค้าง) และเวอร์ชันใหม่ ผ่านทั้งคู่

## 6.5 Realtime appliers — `applyRemoteContext` / `applyRemoteEvidence`

ประตูเดียวที่ event สดจาก Supabase Realtime แตะ store (ทำให้ test ได้โดยไม่ต้อง mock network):

- `applyRemoteContext(c)` — LWW บน `updatedAt`: ใหม่กว่าเท่านั้นถึงเขียนทับ (echo ของ push ตัวเองย้อนไม่ได้), id ที่ไม่มี = insert, `deletedAt` มีค่า = ลบ local copy (id ไม่รู้จัก = no-op ไม่สร้างแถวผี)
- `applyRemoteEvidence(e)` — immutable: ช่องว่างเท่านั้นที่เติม, echo/duplicate เป็น no-op
- ทั้งคู่อยู่ใน store ไม่ใช่ sync.ts — เพื่อให้ unit test ใช้ store จริงได้ตรง ๆ (ดู context-sync.test.ts ท้ายไฟล์)
- `deletedAt` เป็นฟิลด์ sync/realtime-only (client domain ไม่เคย set) — mapper สองฝั่ง map `deleted_at` ครบแล้ว

---

# 7. Realtime — อีกอุปกรณ์เห็นทันทีโดยไม่ reload (`realtime.ts` + `use-context-realtime.ts`)

## 7.1 การเลือกกลไก: postgres_changes (ไม่ใช่ client broadcast)

- **RLS ครอบคลุมทุก event โดยดีไซน์** — ไม่ต้องมี private-channel authorization setup, ไม่มีข้อมูลข้าม user ได้เลย
- soft delete ไหลผ่าน UPDATE event ที่แถวมี `deleted_at` (postgres_changes ของ DELETE ให้แค่ id — bridge สังเคราะห์ tombstone ให้ด้วย)
- **ต้องมี publication:** `migrations/0004_realtime_contexts.sql` ใส่ทั้งสองตารางเข้า `supabase_realtime` — ถ้าไม่รัน subscribe สำเร็จแต่ **event ไม่เคยมา** (เช็คด้วย `getRealtimeStatus()`)

## 7.2 Lifecycle

```text
mount (src/routes/__root.tsx: useContextRealtime)
  ├─ getSession → bind channel `contexts-user-<uid>`
  └─ onAuthStateChange → user เปลี่ยน = unbind + rebind (กัน event ข้ามบัญชี)

event → rowToContext/rowToEvidence → applyRemote* (LWW/immutable guards §6.5)
logout → unbind, status = "offline"
```

- channel เป็น **singleton** ต่อหน้า — เรียก bind ซ้ำ user เดิมเป็น no-op
- echo ของ push ตัวเอง (จาก upsert ของเรา) วนกลับมาเป็น event — applyRemote* กรองด้วย LWW/immutable อยู่แล้ว
- ทดสอบ H1/H2 ใน E2E ต้องตั้ง `E2E_EXPECT_REALTIME=1` หลัง apply 0004 แล้วเท่านั้น (ก่อนหน้านั้น skip อย่างซื่อสัตย์)

---

# 7a. Security — RLS สรุป

| ฝ่าย | ผลที่ยืนยันด้วย E2E แล้ว |
|---|---|
| anon (ไม่มี session) | GET ตารางได้ HTTP 200 + **0 แถว** (RLS กรอง ไม่ใช่ 403) |
| user เจ้าของ | เห็น/แก้เฉพาะแถวตัวเอง |
| user ปลอม `user_id` ของคนอื่นใน payload | RLS บล็อก — insert/update ไม่ผ่าน แม้ client ส่ง id มั่ว |
| Realtime event | postgres_changes ส่งเฉพาะแถวที่ RLS อนุญาตให้ session นั้น — ไม่มีข้อมูลข้าม user |

ข้อสังเกตสำหรับ QA: anon เจอ 200/empty **ไม่ใช่บั๊ก** — PostgREST + RLS ตอบ success กับชุดผลที่ว่างตาม policy

---

# 8. Offline & Error Resilience

หลักครอบคลุมทุกเส้นทาง:

> **ข้อมูล local ไม่มีทางหาย — คลาวด์พังหรือยังไม่พร้อม ทำได้แค่ "ล้าหลัง" ไม่เคย "สูญหาย"**

## 8.1 Outbox Retry Queue (`outbox.ts`)

คิวถาวร (persist ใน localStorage: `secretary-sync-outbox-v1`) สำหรับ push ที่พัง:

```text
push พัง (offline/5xx/ตารางหาย)
      ▼
enqueueOutbox({ table, id, op: upsert|soft-delete|hard-delete, row })
      ▼ dedupe latest-wins ต่อ (table,id,op) — payload เก่าถูกแทนที่
      ▼ cap 500 แถว — เต็มแล้วทิ้งตัวเก่าสุด (ใหม่สำคัญกว่า)
      ▼
flush triggers: event "online" / tab visible / auth SIGNED_IN|TOKEN_REFRESHED|INITIAL_SESSION /
               หลัง login-sync จบ / enqueue ใหม่ทุกครั้ง (debounce 1s)
      ▼
flushOutbox(): replay FIFO ด้วย Supabase ตรง (ห้าม re-enqueue ซ้อน)
  ├─ สำเร็จ → remove จากคิว (toast success รวมจำนวน)
  ├─ พัง → attempts++ แล้วหยุดพาส (หัวคิวค้าง = รอ window ถัดไป)
  │         ครบ MAX_OUTBOX_ATTEMPTS(5) → drop ถาวร + toast แจ้งผู้ใช้
  └─ throw → ถือเป็นความพังของพาสนั้น flush ไม่ตาย
```

- `removeFromOutbox(table,id)` เมื่อ push ปกติสำเร็จ — คิวเก่ากลายเป็นโมฆะทันที
- exception จาก replay ถูก catch ที่ `flushOutbox` — นับเป็นความพังของ window นั้น ไม่พังทั้ง flush
- คิวว่างไม่เรียก replay, flush รันพร้อมกันหลายทริกเกอร์ไม่ซ้อนกัน (guard `flushing`)

## 8.2 ตารางสถานการณ์

| สถานการณ์ | พฤติกรรม | กลไก |
|---|---|---|
| Offline ตอนเปลี่ยนข้อมูล | commit local สำเร็จทันที, push พัง → toast + เข้า outbox | fire-and-forget + `notifyPushFailure` + `enqueueOutbox` |
| กลับออนไลน์ | outbox flush อัตโนมัติ — ข้อมูลขึ้นคลาวด์เอง ไม่ต้องแตะ UI | event `online` (§8.1, พิสูจน์แล้วด้วย E2E G1–G5) |
| Offline / pull พัง ตอน login | `pullAll()` return `null` → bail + toast — **ห้ามตีความเป็น "remote ว่าง"** (ไม่งั้น first-login จะ overwrite คลาวด์ด้วยของ local) | pull-fail guard (§4.4) |
| ตารางยังไม่ถูกสร้าง (404 `PGRST205`) | แอปใช้งานได้ปกติฝั่ง local, push fail-loud มี toast, console ไม่มี uncaught error | พิสูจน์แล้วด้วย E2E resilience mode (§9) |
| Push โดนแถว legacy ผิด constraint | batch แตก chunk ละ 25 — ส่วนที่ถูกต้องขึ้นคลาวด์ | `upsertWithFallback` (§4.3) |
| ตารางเดียว sync ไม่ได้ | ตารางอื่นยัง sync ต่อ, throw aggregate ตอนจบ | per-table isolation ใน `pushAllLocal` |
| ไม่มี session | push helpers return เงียบ (ไม่มีอะไรจะ push — ไม่ใช่ error) | `getCurrentUserId() === null` guard |
| Reload หลังแก้ offline | ข้อมูล persist ครบ, `updatedAt` ใหม่กว่า → ชนะ LWW ตอน login ถัดไป แล้วถูก push กลับ | `mergeContexts` (§4.5) |
| Push พังถาวร (เช่น constraint ที่แก้ไม่ได้) | พยายาม 5 ครั้งแล้ว drop ออกจากคิว + toast แจ้งชัดเจน ไม่ค้างวนตลอดกาล | `MAX_OUTBOX_ATTEMPTS` + `notifyOutboxDropped` |

---

# 9. การทดสอบ (สถานะปัจจุบัน)

| ชั้น | ไฟล์ | ครอบคลุม |
|---|---|---|
| Unit | `src/lib/supabase/context-sync.test.ts` | mapper roundtrip ทั้งสองตาราง, null-safety ของ jsonb, LWW: local-win / remote-win / new-row / empty (mock `getSupabase` — ไม่แตะเครือข่าย) |
| Unit | `src/lib/supabase/outbox.test.ts` | คิว 13 กรณี: dedupe latest-wins, FIFO, cap 500, persistence, removeFromOutbox, flush สำเร็จ/พัง/exception, budget 5 ครั้ง, head-of-line blocking |
| E2E (outbox) | `scripts/context-sync-e2e.mjs` ส่วน G | ตัดเน็ตจริง (`setOffline`) → สร้างบริบทได้ → push พังลงคิว (queued=2: context+evidence) → คลาวด์ยังว่าง → กลับออนไลน์ → flush ขึ้นคลาวด์เอง → คิวว่าง |
| E2E (realtime) | `scripts/context-sync-e2e.mjs` ส่วน H | อุปกรณ์หนึ่งสร้าง → อุปกรณ์สองเห็นการ์ดใหม่เองภายใน ~8 วิ **ไม่ reload**; PATCH `deleted_at` จากภายนอก → การ์ดหายเอง — **ต้อง apply 0004 + `E2E_EXPECT_REALTIME=1`** (ยังไม่ apply = SKIP) |
| Full suite | `npm test` | 193/193 ผ่าน (รวม test ชุดเดิมทั้งหมด) |
| E2E | `scripts/context-sync-e2e.mjs` | 17 ขั้น: login (session cookie ตาม format `@supabase/ssr` — chunk 3180 chars, `"base64-" + base64url`) → สร้างบริบทผ่าน UI → push จริง → reload persist → อุปกรณ์ที่สอง pull → ยืนยัน lifecycle → LWW merge กลับ → RLS 3 กรณี → outbox offline→online (ส่วน G) |
| Gates | typecheck / build / smoke | ผ่านทั้ง dev และ built output (:8081) |

**โหมดพิเศษของ E2E:** ถ้า probe ตารางได้ 404 (`PGRST205`) จะสลับเป็น **resilience mode** — พิสูจน์ว่าแอปเจอ "ตารางยังไม่มี" แล้ว login/create/persist ทำงาน, push พังแบบ fail-loud มี toast, console ไม่มี uncaught error ใช้เป็น regression test ของเส้นทาง degraded

**User ทดสอบ:** `e2e.probe.secretary@gmail.com` (สร้างผ่าน admin API, email confirmed) — sign-in ด้วย password grant เพื่อเลี่ยง Google OAuth ที่ทำไม่ได้ใน headless browser

---

# 10. Bugs ที่เคยเจอระหว่างทำ (regression notes — ห้ามกลับไปเป็นแบบเดิม)

1. **Seed accounts ใช้ id ที่ไม่ใช่ UUID** (`acc-default-0-cash`) บนตาราง `accounts` ชนิด `uuid` → first-login push โดน 400 ทุกครั้ง และหลัง hardening (throw) มันจม `pushAllLocal` ทั้งก้อน → แก้: seed สร้าง UUID ตั้งแต่ต้น
2. **Error ของ supabase-js ถูกทิ้ง** (`upsertRow`/`deleteRow`/`hardDeleteRow`/`pushAllLocal` เดิมไม่เช็คค่า error) → push พลาดเงียบ ทำลาย fail-loud contract → แก้: throw ทุกจุด
3. **`Set` หายตอน persist** (§6.4) → pattern-only flags รั่วทุก reload → แก้ด้วย `partialize` + `merge`
4. **pushAllLocal ตายทั้งก้อนเมื่อตารางเดียวพัง** → แก้: แยกความพังรายตาราง + throw aggregate
5. **pull พังถูกตีความเป็น "remote ว่าง"** (ชุดเดิมของ finance/goals) → เสี่ยง overwrite คลาวด์ตอน first-login → แก้: `pullAll` return `null` + caller bail

---

# 11. ข้อจำกัดปัจจุบัน & ทิศทางต่อยอด

| หัวข้อ | สถานะ | ทางต่อ |
|---|---|---|
| Realtime | ✅ ทำแล้ว — postgres_changes บนสองตาราง + apply เข้า store ทันที (§7); event จริงต้อง apply publication 0004 ก่อน | ถ้าต้องการ presence/typing: เพิ่ม broadcast channel เฉพาะจุด |
| Retry queue | ✅ ทำแล้ว — outbox persist ใน localStorage, flush ตอน online/visible/login, budget 5 ครั้ง (§8.1) | ถ้าต้องการ backoff ตามเวลา: เพิ่ม `nextAttemptAt` ใน entry + setInterval สแกนคิว |
| Conflict granularity | LWW ระดับแถว | ถ้าเกิดแก้ขนานบ่อย: merge ระดับ field สำหรับ facts/tags, หรือ CRDT เฉพาะจุด |
| Judgment Boundary sync | ธง pattern-only อยู่เฉพาะเครื่อง (ไม่มีคอลัมน์บน DB) — เครื่องใหม่เริ่มว่าง | ถ้าต้องการข้ามเครื่อง: เพิ่มคอลัมน์ `pattern_only boolean` + ใส่ใน mapper/LWW (ต้องพิจารณาก่อนว่าขัดหลัก §6.2 หรือไม่) |
| Multi-user sharing | มีคอลัมน์ `shared_with_user_ids` + `canonical_id` รออยู่ แต่ RLS ยังล็อกเจ้าของเดียว | ขยาย policy ตอนทำ Shared Context / S2S (§20–22 ของ SECRETARY-ARCHITECTURE.md) |
| Store อื่น | finance/goals/calendar sync อยู่แล้วแต่ pull ยัง `replaceAll` (ไม่มี LWW) | ยก pattern ของ `mergeContexts` ไปใช้ถ้าต้องการ offline-edit ข้ามเครื่องจริงจัง |

---

# 12. Cheat Sheet — ทำงานกับระบบนี้

**เพิ่มฟิลด์ใหม่ใน Context:**
1. `src/lib/context/types.ts` → เพิ่มใน type
2. `migrations/0004_*.sql` → เพิ่มคอลัมน์ (jsonb ถ้าเป็นโครงสร้างซ้อน)
3. `sync.ts` → mapper สองฝั่ง + **unit test roundtrip**
4. E2E ถ้ากระทบ push/pull path

**Debug sync ไม่ขึ้น:**
1. Probe ตาราง: GET `contexts?select=id&limit=1` ด้วย user token → 404 = migration ยังไม่ถูก apply (`PGRST205`)
2. Console ต้องมี `[sync] push failed:` ถ้าพังแบบเงียบ = มีจุดที่กลืน error (กฎเหล็ก §4.2 ถูกฝ่า)
3. Toast ไม่โผล่ = เช็ค throttle 60s ก่อนสรุปว่าไม่ยิง
4. เช็คคิว outbox: `JSON.parse(localStorage.getItem("secretary-sync-outbox-v1"))` — มีแถวค้าง = push ยังไม่ถึงคลาวด์ รอ flush หรือ debug ตามข้อ 2

**ทดสอบเต็มชุด:**
```bash
npm test                          # unit + full suite (รวม outbox + applyRemote)
node scripts/context-sync-e2e.mjs # E2E 19 ขั้น (ต้องมีตารางบน Supabase แล้ว)
# หลัง apply 0004 แล้ว เปิดทดสอบ realtime ด้วย:
E2E_EXPECT_REALTIME=1 node scripts/context-sync-e2e.mjs
```
