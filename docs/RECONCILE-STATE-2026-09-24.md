# Secretary — Reconciled State & Entry Command

> เอกสารแบบเดียวที่คนใดคนหนึ่งเปิดแล้วรู้ทันทีว่าโปรเจกต์อยู่ที่ไหน ก่อนจะเขียนบรรทัดไหน

**วันที่:** 24 Sep 2026  
**Git State:** Reconciled (local = remote = working tree, modulo CRLF)  
**เกณฑ์:** ไม่มี code ที่ค้าง — ไม่มี commit/push/pull/reset ที่ต้องทำก่อนเริ่ม

---

## 1. Truth Table (3-way)

| Reference | SHA | วันที่ | สถานะ |
|---|---|---|---|
| **Local HEAD** (`preview`) | `00f83b302d0317cfaeaab4c5d05dd0b1e8caec4d` | 24 Sep 12:37 | 🟢 |
| **origin/preview** | `00f83b302d0317cfaeaab4c5d05dd0b1e8caec4d` | — | 🟢 SYNCED |
| **Working Tree** | matches `00f83b3` | — | 🟢 (เปลี่ยนแค่ CRLF + file mode) |

**3 จุดเหมือนกันทั้งหมด** — ไม่มี diverged state เลย

### การแตกต่าง Working Tree กับ HEAD คืออะไร?

| ประเภท | ไฟล์ | จำนวน | รายละเอียด |
|---|---|---|---|
| **CRLF / line-ending** | ทุกไฟล์ .ts/.tsx/.mjs/.md/.sql ฯลฯ | ~95 | Windows บันทึกเป็น `\r\n` → git เห็นทุกบรรทัดเป็น "modified" |
| **File mode** | `docs/SECRETARY-HUMAN-CENTERED-DESIGN-NOTES.md` | 1 | `100644 → 100755` (executable bit) |
| **Content change จริง** | — | **0** | `git diff --ignore-space-at-eol HEAD` = 0 insertions / 0 deletions |

> ดังนั้น `git diff HEAD` ที่ดูน่ากังวลเป็น **false positive จาก Windows-only artifact** — ไม่ใช่ code change

### HEAD vs HEAD~1 (สรุป commit ล่าสุด)

- `00f83b3` → `7a01bd2` มีการเปลี่ยนแปลง **เฉพาะ `docs/SESSION-HANDOFF-2026-09-24.md`** (95 lines เพิ่ม)
- ทุกไฟล์ใน `src/`, `scripts/`, `migrations/` เหมือนก่อนหลัง `00f83b3`
- หรืออื่น ๆ **`7a01bd2`** คือ commit ทางการของ code ล่าสุด:
  - `fix(migrations): idempotent 0002/0004 + PGLite regression tests + realtime runbook`
  - ทุก gates ผ่านทั้ง dev + built + ทดสอบจริงบน cloud

---

## 2. บรรยทัดฐาน (Current State)

### App Shell (ทำงานแล้ว)
- `<AuthProvider>` + `<PreviewHostBridge />` + Toaster — ตามสัญญา
- ชื่อแอป: **คุณเลขา**
- Dev server: `npm run dev` → `0.0.0.0:8080` (via `startup.sh`)
- Production build: `npm run build` → `npm run preview` บน `:8081`

### Routes
| Route | สถานะ | หน่วยความจริง |
|---|---|---|
| `/` | ✅ Working | Finance home: summary, period switch, capture bar, context input/feed, transactions |
| `/context-card-demo` | ✅ Working | Context Card 4-step flow (input → card → edit/swipe → confirm) |
| `/context` | ✅ Exists | Overview page with search + filters |
| `/goals` | ✅ Working | Goals CRUD |
| `/calendar` | ✅ Working | Month grid + day + event form |
| `/accounts` | — | Accounts page |
| `/quota` | — | Quota card |
| `/login` | ✅ Exists | Sign-in page |

### Infra (เฉพาะ)
| Layer | Status | หมายเหตุ |
|---|---|---|
| Supabase sync | ✅ ทำงานจริง | outbox retry, realtime bridge, LWW merge, RLS 7 ตาราง |
| Realtime H1/H2 | ✅ ทดสอบรีักจริงง | publication toggles ใน Dashboard (ไม่ใช่ SQL Editor) |
| PGLite fallback | ✅ Idempotent migrations | `0002/0003/0004` ผ่านทั้ง postgres + pgLite |
| Better Auth | ✅ เชื่อมต่อ | self-hosted + broker federation |

### Context Domain Model (Step 1.1 — ✅ เสร็จ)
- `src/lib/context/types.ts` — canonical ประเภท (SecretaryContext, Evidence, Fact, Inference, Lifecycle, ChangeEvent, EntityLink, RelatedContext)
- `src/lib/context/store.ts` — Zustand store พร้อม provenance chain + lifecycle validation
- `src/lib/context/context.test.ts` — 1250 lines domain behavior tests (10 หมวด)
- Appendix A ใน ARCHITECTURE.md มี DOD ครบ 10 ข้อ ✅ (ยกเว้น test pass อยู่ในสถานะ ⏳)

---

## 3. Target Slice (slice ที่ควรทำต่อ)

### ข้อจำกัดจาก session ก่อน
> "อย่าสร้างหน้าถัดไขเพราะหน้าถัดไปควรมี — สร้างเมื่อรู้ว่ามาจาก journey ไหน"

### ตัวเลือก 2 แบบ (เลือกหนึ่ง)

| Option | อธิบาย | User Journey ที่พิสูจน์ |
|---|---|---|
| **A: `/context` page** | Context overview + detail view (Statement จาก Facts) — Step 1.3 ของ architecture doc | "เรื่องเงินขยายให้ผมดูหน่อย" → Context Card ขยายเป็น Statement |
| **B: Share Card (`og.jpg`)** | Share card สำหรับ Context — ใช้ `src/lib/og/site.json` | Mobile share flow: user แชร์ context card ไปกับคนอื่น |

### แนะนำจาก Architecture Doc
```
Step 1.1 ✅ Context Model
   ↓
Step 1.2 ⬜ ContextCard Primitive (UI component ที่ VIEW Context)
   ↓
Step 1.3 ⬜ Statement / Detail View — derived from Facts
   ↓
Step 2.1 ⬜ Workspace Layout
```

**Slice ที่เหมาะที่สุด:** Step 1.2 → Step 1.3 (ContextCard + Statement View)  
เหตุผล: เป็น development order ที่เอกสารระบุไว้ชัดเจน และเชื่อมโยงกับ North Star Experience (Context → Workspace → Statement → Related Data)

---

## 4. คำสั่งสำหรับคนถัดไป

### ก่อนเริ่ม (5 นาที)
```bash
cd /workspace  # หรือ /run/media/bombuntu/HDD STORAGE 1/DevProject/secretary-main
git status          # ควรเห็น 97 files "modified" (CRLF noise only)
git log --oneline -3  # ควรเห็น 00f83b3 เป็น HEAD
```

### เปิ่น dev server
```bash
sh startup.sh       # ตรวจ 8080, เปิดอัตโนมัติ
# หรือ: npm run dev
```

### เลือก slice (ถามก่อนสร้าง)
```bash
# ถ้าเลือก A (/context + Statement View):
#   → อ้างอิง Appendix A.8 "Next Steps" ใน docs/SECRETARY-ARCHITECTURE.md
#   → อ่าน src/lib/context/store.ts (hasStatements, deriveStatement)
#   → อ่าน src/components/prototype/context-hero-card.tsx (existing UI prototype)
#
# ถ้าเลือก B (Share Card):
#   → อ้างอิง src/lib/og/site.json
#   → อ่าน .grok/references/generated-art.md สำหรับ pipeline
```

### กฎหลีกเลี่ยง (อย่าลงมาเหลือนี้)
1. **อย่า seed `_migrations` บน cloud** — hardening ปัจจุบันรองรับทั้ง seed และ re-run อยู่แล้ว
2. **อย่าทำ Foundation ซ้ำ** (sync/realtime/migrations) — ยกเว้นมี evidence ใหม่ชี้ปัญหา
3. **อย่าเริ่ม slice โดยไม่ได้ถามว่า User Journey คืออะไร** — หลักจาก handoff

---

## 5. ไฟล์อ้างอิงด่วน

| เรื่อง | Path |
|---|---|
| Session Handoff (full gates + lessons) | `docs/SESSION-HANDOFF-2026-09-24.md` |
| Architecture (domain model spec) | `docs/SECRETARY-ARCHITECTURE.md` (Appendix A) |
| Audit & Gap Analysis | `docs/AUDIT-GAP-ANALYSIS.md` |
| Context Model Type Def | `src/lib/context/types.ts` |
| Context Store | `src/lib/context/store.ts` |
| Context Domain Tests | `src/lib/context/context.test.ts` |
| Migration Idempotency Test | `scripts/migrations-idempotency.test.mjs` |
| E2E Sync/Realtime | `scripts/context-sync-e2e.mjs` |
| Context Card QA | `scripts/context-card-qa.mjs` |
| Realtime Runbook | `docs/CONTEXT-SYNC-ARCHITECTURE.md` |
| Startup Script | `startup.sh` |

---

## 6. สรุปสั้น (One-Liner)

> `00f83b3` — Secretary มี app shell + context domain model (Step 1.1 ✅) + sync real-time ทำงานจริงครบ gates  
> **Slice ต่อไป:** ContextCard Primitive (Step 1.2) → Statement View (Step 1.3)  
> **ก่อนเริ่ม:** ตัดสินใจว่า User Journey คืออะไรกับ Share Card หรือ /context page
