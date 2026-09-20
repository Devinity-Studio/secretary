# Card-Based Interaction UX — Analysis & Design

> **สถานะ:** สำหรับ Review และ Approval เท่านั้น ยังไม่แก้ไข Specification ใด ๆ
>
> **วันที่:** 4 กันยายน 2026
>
> **บทบาท:** UX Architect + Interaction Designer
>
> **วัตถุประสงค์:** วิเคราะห์ Card-Based Workflow สำหรับ Hybrid AI System

---

## สารบัญ

- [A. UX Problem Inventory](#a-ux-problem-inventory)
- [B. Card Type Proposal](#b-card-type-proposal)
- [C. Card Lifecycle / State Model](#c-card-lifecycle--state-model)
- [D. User Interaction Flow](#d-user-interaction-flow)
- [E. Error & Recovery UX](#e-error--recovery-ux)
- [F. Hybrid AI UX](#f-hybrid-ai-ux)
- [G. Mobile-first Considerations](#g-mobile-first-considerations)
- [H. Accessibility Considerations](#h-accessibility-considerations)
- [I. Architecture Impact](#i-architecture-impact)
- [J. MVP / Later Priority](#j-mvp--later-priority)

---

# A. UX Problem Inventory

## ปัญหาที่ Card-Based Workflow ต้องแก้

| # | Problem | Why Card-Based Helps |
|---|---------|---------------------|
| U01 | ผู้ใช้ไม่เข้าใจว่าระบบกำลังทำอะไร | Card แสดงสถานะชัดเจน (processing → result) |
| U02 | ผู้ใช้ไม่รู้ว่า AI ให้ผลผิด | Card แสดง confidence + allow correction |
| U03 | ผู้ใช้สับสนเมื่อ AI หลายตัวทำงานพร้อมกัน | Card แยกผลลัพธ์จากแต่ละ AI |
| U04 | ผู้ใช้ไม่สามารถ undo ได้หลังบันทึก | Card มี lifecycle ชัดเจน |
| U05 | ผู้ใช้ไม่เห็น audit trail | Card เก็บประวัติทั้งหมด |
| U06 | ผู้ใช้ไม่เข้าใจ error message | Error Card แสดงผลง่าย |
| U07 | ผู้ใช้กดซ้ำ / ทำอะไรซ้ำ | Card มี idempotency + debounce |
| U08 | ผู้ใช้ออกจากหน้าระหว่าง processing | Card persist ใน background |
| U09 | ผู้ใช้ไม่สามารถเปรียบเทียบผลลัพธ์ได้ | Multiple Result Card side-by-side |
| U10 | ผู้ใช้ไม่เข้าใจ partial success | Progress Card แสดงส่วนที่สำเร็จ/ล้มเหลว |
| U11 | ผู้ใช้ต้องการ cancel task ที่กำลังทำ | Cancel button บน Process Card |
| U12 | ผู้ใช้ต้องการแก้ไขผลลัพธ์ก่อนบันทึก | Edit mode บน Result Card |
| U13 | ผู้ใช้ต้องการเลือก AI provider | Provider selection Card |
| U14 | ผู้ใช้ไม่เห็น quota ที่เหลือ | Quota Card แสดง usage |
| U15 | ผู้ใช้ต้องการดูประวัติ AI requests | History Card / timeline |

---

# B. Card Type Proposal

## 1. Command Card (สิ่งที่ User สั่ง)

```
┌─────────────────────────────────────────┐
│ 💬 Command Card                         │
├─────────────────────────────────────────┤
│ "กาแฟ 65"                              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📍 วันนี้ · บัญชีเงินสด            │ │
│ │ 🏷️ อาหาร · รายจ่าย                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ แก้ไข ]  [ ยืนยัน & บันทึก ]         │
└─────────────────────────────────────────┘
```

**ข้อมูลที่ควรมี:**
- ข้อความที่ user พิมพ์ (raw input)
- ผลลัพธ์ parse (type, amount, category, account, date)
- Confidence score (ถ้ามี AI)
- Timestamp
- Status (new / editing / confirmed)

**User Actions:**
- แก้ไข → กลับไป edit mode
- ยืนยัน → บันทึก → เปลี่ยนเป็น Result Card
- ยกเลิก → ลบ card

---

## 2. Process Card (สิ่งที่ระบบกำลังทำ)

```
┌─────────────────────────────────────────┐
│ ⚙️ Process Card                         │
├─────────────────────────────────────────┤
│ 🔄 กำลังวิเคราะห์ "กาแฟ 65"...         │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ AI: Dev8Studio ✅ (1.2s)            │ │
│ │ AI: Free Tier ⏳ กำลังรอ...          │ │
│ │ Rule-based ✅ (0.02s)               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ ยกเลิก ]                              │
└─────────────────────────────────────────┘
```

**ข้อมูลที่ควรมี:**
- คำสั่งต้นฉบับ (link กลับ Command Card)
- สถานะ processing
- แต่ละ AI provider: status + latency
- Progress (ถ้า multi-step)
- Cancel button

**User Actions:**
- ยกเลิก → หยุด processing → แสดง Recovery Card
- รอ → auto-update เมื่อเสร็จ

---

## 3. Result Card (ผลลัพธ์ที่ระบบส่งกลับ)

```
┌─────────────────────────────────────────┐
│ ✅ Result Card                          │
├─────────────────────────────────────────┤
│ 💰 รายจ่าย · กาแฟมื้อเช้า              │
│                                         │
│ ฿65.00                                 │
│ 📅 วันนี้ · 🏦 เงินสด · 🏷️ อาหาร      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🤖 AI Confidence: 95%               │ │
│ │ ⚡ Dev8Studio · 1.2s                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ แก้ไข ]  [ ลบ ]  [ ดูรายละเอียด ]    │
└─────────────────────────────────────────┘
```

**ข้อมูลที่ควรมี:**
- Transaction data (type, amount, category, account, date)
- AI metadata (provider, confidence, latency)
- Link กลับ Command Card
- Link ไป Recovery Card (ถ้ามี)
- Timestamp
- Status (saved / editing / deleted)

**User Actions:**
- แก้ไข → edit mode → save → update card
- ลบ → confirm → delete
- ดูรายละเอียด → expand / open detail view

---

## 4. Recovery Card (สิ่งที่ระบบทำเมื่อเกิดปัญหา)

```
┌─────────────────────────────────────────┐
│ 🔧 Recovery Card                        │
├─────────────────────────────────────────┤
│ ⚠️ AI ไม่สามารถประมวลผลได้             │
│                                         │
│ "โอนเงินเข้าออม 5000"                  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ❌ Dev8Studio: Timeout (5s)         │ │
│ │ ❌ Free Tier: Rate limited          │ │
│ │ ✅ Rule-based: สำเร็จ (0.02s)       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 ผลลัพธ์จากระบบสำรอง:                │
│ → โอนเงิน ฿5,000 ไปบัญชีออม            │
│                                         │
│ [ ใช้ผลลัพธ์นี้ ]  [ แก้ไข ]  [ ลองใหม่ ]│
└─────────────────────────────────────────┘
```

**ข้อมูลที่ควรมี:**
- ปัญหาที่เกิดขึ้น (error type)
- แต่ละ AI provider: status + error reason
- Fallback result (ถ้ามี)
- Recovery action options
- Link กลับ Command Card

**User Actions:**
- ใช้ผลลัพธ์สำรอง → สร้าง Result Card
- แก้ไข → edit mode
- ลองใหม่ → retry → Process Card

---

## 5. Error / Escalation Card (สิ่งที่ต้องแจ้งมนุษย์)

```
┌─────────────────────────────────────────┐
│ 🚨 Error Card                           │
├─────────────────────────────────────────┤
│ ❌ ไม่สามารถบันทึกได้                   │
│                                         │
│ "จ่ายค่าไฟ 1,200"                      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ปัญหา: ไม่แน่ใจว่าเป็นรายจ่าย      │ │
│ │ หรือโอนเงิน                         │ │
│ │                                     │ │
│ │ AI ทั้งหมดให้ผลลัพธ์ขัดแย้งกัน       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 กรุณาเลือกด้วยตนเอง:                │
│ [ รายจ่าย ]  [ โอนเงิน ]  [ ยกเลิก ]   │
└─────────────────────────────────────────┘
```

**ข้อมูลที่ควรมี:**
- Error type (conflict / ambiguity / system error)
- ข้อมูลที่มีอยู่
- Options สำหรับ user
- Escalation path

**User Actions:**
- เลือก option → สร้าง Result Card
- ยกเลิก → ลบ card

---

## 6. Progress Card (Partial Success / Long-running)

```
┌─────────────────────────────────────────┐
│ 📊 Progress Card                        │
├─────────────────────────────────────────┤
│ 🔄 กำลังประมวลผล 3 รายการ...            │
│                                         │
│ ✅ กาแฟ 65 — สำเร็จ                    │
│ ✅ เงินเดือน 28000 — สำเร็จ             │
│ ⏳ โอนออม 5000 — กำลังทำ...             │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ████████████░░░░░░░░ 67%            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ ยกเลิกทั้งหมด ]                       │
└─────────────────────────────────────────┘
```

**ข้อมูลที่ควรมี:**
- Total items
- Completed / Failed / Pending counts
- Progress bar
- Per-item status
- Cancel button

---

## 7. Comparison Card (Multiple AI Results)

```
┌─────────────────────────────────────────┐
│ ⚖️ Comparison Card                      │
├─────────────────────────────────────────┤
│ "โอนเงินเข้าออม 5000"                  │
│                                         │
│ ┌─────────────┬─────────────┐           │
│ │ 🤖 Dev8     │ 🤖 Free Tier│           │
│ ├─────────────┼─────────────┤           │
│ │ Transfer    │ Expense     │           │
│ │ ฿5,000      │ ฿5,000      │           │
│ │ → Savings   │ → Food      │           │
│ │ Conf: 92%   │ Conf: 78%   │           │
│ └─────────────┴─────────────┘           │
│                                         │
│ 💡 ผลลัพธ์ขัดแย้งกัน                     │
│                                         │
│ [ เลือก Dev8 ]  [ เลือก Free Tier ]     │
│ [ แก้ไขเอง ]  [ ยกเลิก ]               │
└─────────────────────────────────────────┘
```

---

## 8. Audit Card (History / Traceability)

```
┌─────────────────────────────────────────┐
│ 📋 Audit Card                           │
├─────────────────────────────────────────┤
│ 🕐 ประวัติคำขอ "กาแฟ 65"               │
│                                         │
│ 14:32:01 — User พิมพ์ "กาแฟ 65"        │
│ 14:32:01 — Rule-based: สำเร็จ (20ms)    │
│ 14:32:02 — Dev8Studio: สำเร็จ (1.2s)    │
│ 14:32:02 — Cross-validation: Match ✅   │
│ 14:32:02 — User ยืนยัน                  │
│ 14:32:02 — บันทึกลง database            │
│                                         │
│ [ ปิด ]                                 │
└─────────────────────────────────────────┘
```

---

## Card Summary Table

| Card Type | User-Facing | Technical | Can Merge | Priority |
|-----------|-------------|-----------|-----------|----------|
| Command Card | ✅ | ❌ | ❌ — เป็น entry point | Critical |
| Process Card | ✅ | Partial | ❌ — ต้องแยก | High |
| Result Card | ✅ | ❌ | ✅ — รวมกับ Command ได้หลัง confirm | Critical |
| Recovery Card | ✅ | Partial | ✅ — รวมกับ Error ได้ | High |
| Error Card | ✅ | Partial | ✅ — รวมกับ Recovery ได้ | High |
| Progress Card | ✅ | ❌ | ❌ — สำหรับ batch | Medium |
| Comparison Card | ✅ | ❌ | ❌ — สำหรับ multi-AI | Medium |
| Audit Card | Partial | ✅ | ❌ — technical view | Low |

---

# C. Card Lifecycle / State Model

## State Diagram

```
                    ┌──────────────┐
                    │   CREATED    │
                    └──────┬───────┘
                           │ user types input
                           ▼
                    ┌──────────────┐
            ┌──────│  COMMAND     │──────┐
            │      │  (Preview)   │      │
            │      └──────┬───────┘      │
            │             │              │
       user edit      user confirm   user cancel
            │             │              │
            ▼             ▼              ▼
     ┌──────────┐  ┌──────────┐   ┌──────────┐
     │ EDITING  │  │PROCESSING│   │ CANCELLED│
     └────┬─────┘  └────┬─────┘   └──────────┘
          │              │
     user save      ┌────┴────┐
          │         │         │
          │     success    error
          │         │         │
          │         ▼         ▼
          │  ┌──────────┐ ┌──────────┐
          │  │ RESULT   │ │ RECOVERY │
          │  │ (Saved)  │ │          │
          │  └────┬─────┘ └────┬─────┘
          │       │            │
          │    user edit   user retry
          │       │            │
          │       ▼            │
          │  ┌──────────┐     │
          │  │ EDITING  │     │
          │  └────┬─────┘     │
          │       │            │
          └───────┼────────────┘
                  │
                  ▼
           ┌──────────┐
           │  RESULT  │
           │ (Final)  │
           └──────────┘
```

## State Definitions

| State | Description | User Can Interact | Background Task |
|-------|-------------|-------------------|-----------------|
| `CREATED` | Card ถูกสร้างขึ้น | ❌ | None |
| `COMMAND` | แสดง preview ให้ user ยืนยัน | ✅ | None |
| `EDITING` | User กำลังแก้ไข | ✅ | None |
| `PROCESSING` | กำลังส่ง AI / ประมวลผล | Partial (cancel only) | AI request |
| `RESULT` | บันทึกสำเร็จ | ✅ | None |
| `RECOVERY` | กำลังกู้คืนจาก error | Partial (retry/cancel) | Retry logic |
| `ERROR` | ล้มเหลวทั้งหมด | ✅ | None |
| `CANCELLED` | User ยกเลิก | ❌ | None |
| `COMPARING` | เปรียบเทียบผลจากหลาย AI | ✅ | None |

## Card Properties

```typescript
interface Card {
  id: string;
  type: 'command' | 'process' | 'result' | 'recovery' | 'error' | 'progress' | 'comparison' | 'audit';
  state: CardState;
  
  // Core data
  input: string;                    // raw user input
  parsedResult?: ParsedResult;      // parsed output
  aiResults?: AIResult[];           // results from multiple AIs
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  userId: string;
  
  // AI tracking
  requestId?: string;               // correlation ID
  providers?: ProviderStatus[];     // status per provider
  confidence?: number;              // overall confidence
  
  // Linking
  parentId?: string;                // parent card (e.g., Command → Result)
  childIds?: string[];              // child cards
  
  // Audit
  auditTrail?: AuditEntry[];
  
  // UI state
  expanded?: boolean;
  selected?: boolean;
}

interface AIResult {
  provider: string;
  model: string;
  output: ParsedResult;
  confidence: number;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout' | 'rate_limited';
  error?: string;
}

interface ProviderStatus {
  provider: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'timeout';
  latencyMs?: number;
  error?: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: string;
  actor: 'user' | 'system' | 'ai';
}
```

---

# D. User Interaction Flow

## Flow 1: Simple Command (กาแฟ 65)

```
User พิมพ์ "กาแฟ 65"
       │
       ▼
┌──────────────────┐
│ Command Card     │
│ "กาแฟ 65"       │
│ Preview:         │
│ รายจ่าย ฿65     │
│ อาหาร · เงินสด   │
│                  │
│ [แก้ไข] [ยืนยัน] │
└────────┬─────────┘
         │ user ยืนยัน
         ▼
┌──────────────────┐
│ Process Card     │
│ ⏳ กำลังทำ...    │
│ Rule-based ✅    │
└────────┬─────────┘
         │ success
         ▼
┌──────────────────┐
│ Result Card      │
│ ✅ บันทึกแล้ว    │
│ รายจ่าย ฿65     │
│ กาแฟมื้อเช้า    │
│                  │
│ [แก้ไข] [ลบ]    │
└──────────────────┘
```

## Flow 2: AI Conflict (โอนเงินเข้าออม 5000)

```
User พิมพ์ "โอนเงินเข้าออม 5000"
       │
       ▼
┌──────────────────┐
│ Command Card     │
│ "โอนเงินเข้าออม  │
│  5000"           │
│                  │
│ [แก้ไข] [ยืนยัน] │
└────────┬─────────┘
         │ user ยืนยัน
         ▼
┌──────────────────┐
│ Process Card     │
│ ⏳ กำลังทำ...    │
│ Dev8Studio ⏳    │
│ Free Tier ⏳     │
│ Rule-based ✅    │
└────────┬─────────┘
         │ AI results conflict
         ▼
┌──────────────────┐
│ Comparison Card  │
│ ⚖️ ผลลัพธ์ขัดแย้ง│
│                  │
│ Dev8: Transfer   │
│ Free: Expense    │
│                  │
│ [เลือกDev8]      │
│ [เลือกFree]      │
│ [แก้ไขเอง]      │
└────────┬─────────┘
         │ user เลือก Dev8
         ▼
┌──────────────────┐
│ Result Card      │
│ ✅ บันทึกแล้ว    │
│ โอนเงิน ฿5,000  │
│ → บัญชีออม     │
└──────────────────┘
```

## Flow 3: Recovery (AI ทั้งหมดล้มเหลว)

```
User พิมพ์ "จ่ายค่าไฟ 1,200"
       │
       ▼
┌──────────────────┐
│ Command Card     │
│ [แก้ไข] [ยืนยัน] │
└────────┬─────────┘
         │ user ยืนยัน
         ▼
┌──────────────────┐
│ Process Card     │
│ ⏳ กำลังทำ...    │
│ Dev8Studio ❌    │
│ Free Tier ❌     │
│ Rule-based ❌    │
└────────┬─────────┘
         │ all failed
         ▼
┌──────────────────┐
│ Recovery Card    │
│ 🔧 ระบบสำรอง    │
│                  │
│ ❌ Dev8: Timeout │
│ ❌ Free: Quota   │
│ ❌ Rule: ไม่ชัด  │
│                  │
│ [แก้ไขเอง]      │
│ [ลองใหม่]        │
│ [ยกเลิก]         │
└────────┬─────────┘
         │ user แก้ไขเอง
         ▼
┌──────────────────┐
│ Command Card     │
│ (editable)       │
│ รายจ่าย ฿1,200  │
│ ค่าไฟ            │
│                  │
│ [บันทึก]         │
└────────┬─────────┘
         │ user บันทึก
         ▼
┌──────────────────┐
│ Result Card      │
│ ✅ บันทึกแล้ว    │
└──────────────────┘
```

## Flow 4: Batch Processing (หลายรายการ)

```
User พิมพ์ "กาแฟ 65, เงินเดือน 28000, โอนออม 5000"
       │
       ▼
┌──────────────────┐
│ Command Card     │
│ 3 รายการ         │
│ [แก้ไข] [ยืนยัน] │
└────────┬─────────┘
         │ user ยืนยัน
         ▼
┌──────────────────┐
│ Progress Card    │
│ 📊 กำลังทำ 3/3   │
│                  │
│ ✅ กาแฟ 65      │
│ ✅ เงินเดือน     │
│ ⏳ โอนออม 5000  │
│                  │
│ ████████░░ 67%   │
│                  │
│ [ยกเลิกทั้งหมด]  │
└────────┬─────────┘
         │ all complete
         ▼
┌──────────────────┐
│ 3x Result Cards  │
│ (stacked/list)   │
└──────────────────┘
```

## Flow 5: User Leaves Mid-Processing

```
User พิมพ์ "กาแฟ 65" → ยืนยัน → Process Card แสดง
       │
       │ user navigates away
       ▼
┌──────────────────┐
│ Background       │
│ Processing       │
│ (no UI)          │
└────────┬─────────┘
         │ success
         ▼
┌──────────────────┐
│ Toast/Snackbar   │
│ "กาแฟ 65         │
│  บันทึกแล้ว ✅"  │
│                  │
│ [ดู] [ปิด]       │
└──────────────────┘
```

---

# E. Error & Recovery UX

## Error Types & Display

| Error Type | Card Type | User Action | System Action |
|-----------|-----------|-------------|---------------|
| AI Timeout | Recovery | Retry / Manual | Auto-retry 1x |
| AI Rate Limited | Recovery | Wait / Manual | Backoff + retry |
| AI Quota Exceeded | Recovery | Manual / Use backup | Switch provider |
| AI Conflict | Comparison | Choose | — |
| AI Invalid Output | Recovery | Edit / Retry | Retry with stricter prompt |
| Network Error | Recovery | Retry / Offline | Use rule-based |
| Validation Error | Error | Edit | — |
| Save Error | Error | Retry | — |
| Unknown | Error | Report | Log + alert |

## Recovery Flow Design

```
┌─────────────────────────────────────────────────────────┐
│                    RECOVERY FLOW                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Problem Detected                                       │
│       │                                                 │
│       ▼                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Auto-    │───▶│ Verify   │───▶│ Success? │          │
│  │ Retry    │    │ Result   │    │          │          │
│  └──────────┘    └──────────┘    └────┬─────┘          │
│                                  Yes  │  No             │
│                                   │   │                 │
│                                   ▼   ▼                 │
│                            ┌──────┐ ┌──────────┐       │
│                            │ DONE │ │ Try Next │       │
│                            └──────┘ │ Strategy │       │
│                                     └────┬─────┘       │
│                                          │              │
│                                     ┌────┴────┐        │
│                                     │ Success? │        │
│                                     └────┬─────┘        │
│                                  Yes  │  No             │
│                                   │   │                 │
│                                   ▼   ▼                 │
│                            ┌──────┐ ┌──────────┐       │
│                            │ DONE │ │ Show     │       │
│                            └──────┘ │ Recovery │       │
│                                     │ Card     │       │
│                                     └────┬─────┘       │
│                                          │              │
│                                     User Action         │
│                                          │              │
│                                   ┌──────┼──────┐      │
│                                   │      │      │      │
│                                   ▼      ▼      ▼      │
│                              ┌─────┐ ┌─────┐ ┌─────┐  │
│                              │Retry│ │Edit │ │Cancel│  │
│                              └─────┘ └─────┘ └─────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Recovery Strategies (Ordered by Simplicity)

| Priority | Strategy | When to Use |
|----------|----------|-------------|
| 1 | Auto-retry (same provider) | Transient error, timeout |
| 2 | Retry with backoff | Rate limit |
| 3 | Switch to next provider | Provider error |
| 4 | Use rule-based fallback | All AI failed |
| 5 | Show Recovery Card | All strategies failed |
| 6 | Human escalation | Critical / ambiguous |

---

# F. Hybrid AI UX

## Multi-Provider Display Strategy

### Principle: **Show what matters, hide what doesn't**

| Scenario | What User Sees | What's Hidden |
|----------|---------------|---------------|
| Single AI success | Result Card | Other providers |
| All AI agree | Result Card + "AI verified ✅" | Conflict details |
| AI disagree | Comparison Card | Technical details |
| AI fail, rule-based works | Result Card + "Using backup" | Error details |
| All fail | Recovery Card | Technical jargon |

### Provider Display Rules

```
IF all_providers_agree:
    SHOW Result Card
    SHOW "AI verified" badge
    HIDE provider details

ELSE IF conflict:
    SHOW Comparison Card
    SHOW each provider's result
    ASK user to choose

ELSE IF partial_failure:
    SHOW Result Card (from working provider)
    SHOW warning badge
    HIDE failed provider details (unless user expands)

ELSE IF all_failed:
    SHOW Recovery Card
    SHOW simple error message
    OFFER manual input
```

### Confidence Display

| Confidence | Display | User Action |
|-----------|---------|-------------|
| > 90% | Green badge ✅ | Auto-proceed |
| 70-90% | Yellow badge ⚠️ | Show preview, allow edit |
| 50-70% | Orange badge 🔶 | Show preview, suggest edit |
| < 50% | Red badge ❌ | Show multiple options, ask user |

## Long-Running Tasks

### UX for Tasks > 3 seconds

```
┌─────────────────────────────────────────┐
│ Process Card (expanded)                 │
├─────────────────────────────────────────┤
│ 🔄 กำลังวิเคราะห์...                    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Dev8Studio: ⏳ กำลังทำ... (3.2s)    │ │
│ │ Free Tier: ✅ สำเร็จ (1.1s)         │ │
│ │ Rule-based: ✅ สำเร็จ (0.02s)       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 รอ AI ตัวสุดท้าย...                  │
│                                         │
│ [ ยกเลิก ]                              │
└─────────────────────────────────────────┘
```

### UX for Tasks > 10 seconds

```
┌─────────────────────────────────────────┐
│ Process Card (persistent)               │
├─────────────────────────────────────────┤
│ 🔄 กำลังวิเคราะห์...                    │
│                                         │
│ ⏱️ ใช้เวลา 12 วินาที                    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ████████████░░░░░░░░ 60%            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 บางครั้งใช้เวลาสักครู่...             │
│                                         │
│ [ ยกเลิก ]                              │
└─────────────────────────────────────────┘
```

---

# G. Mobile-first Considerations

## Card Sizing

| Screen | Card Width | Padding | Font Size |
|--------|-----------|---------|-----------|
| Mobile (< 640px) | 100% | 16px | 14-16px |
| Tablet (640-1024px) | 100% | 24px | 14-16px |
| Desktop (> 1024px) | Max 480px | 24px | 14-16px |

## Touch Targets

| Element | Min Size | Recommended |
|---------|----------|-------------|
| Button | 44x44px | 48x48px |
| Icon button | 44x44px | 48x48px |
| Link | 44px height | 48px height |
| Card tap area | Full card | Full card |

## Swipe Actions

| Card Type | Swipe Left | Swipe Right |
|-----------|-----------|-------------|
| Command | ยกเลิก | ยืนยัน |
| Result | ลบ | แก้ไข |
| Recovery | ยกเลิก | ลองใหม่ |

## Bottom Sheet (Mobile)

สำหรับ Card ที่ต้อง interaction มาก → ใช้ Bottom Sheet:

```
┌─────────────────────────────────────────┐
│ ⋮ (drag handle)                        │
├─────────────────────────────────────────┤
│                                         │
│ ⚖️ เปรียบเทียบผลลัพธ์                   │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Dev8Studio                         │ │
│ │ Transfer ฿5,000 → Savings          │ │
│ │ Confidence: 92%                    │ │
│ │                     [เลือก]         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Free Tier                          │ │
│ │ Expense ฿5,000 → Food              │ │
│ │ Confidence: 78%                    │ │
│ │                     [เลือก]         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ แก้ไขเอง ]  [ ยกเลิก ]               │
└─────────────────────────────────────────┘
```

## Animation

| Action | Animation | Duration |
|--------|-----------|----------|
| Card appear | Slide up + fade in | 200ms |
| Card update | Crossfade content | 150ms |
| Card disappear | Slide down + fade out | 200ms |
| Progress | Linear fill | 300ms |
| Error shake | Horizontal shake | 300ms |

---

# H. Accessibility Considerations

## Screen Reader

| Element | aria-label | aria-live |
|---------|-----------|-----------|
| Command Card | "Command card: {input}" | polite |
| Process Card | "Processing: {status}" | assertive |
| Result Card | "Result: {summary}" | polite |
| Recovery Card | "Recovery options available" | assertive |
| Error Card | "Error: {message}" | assertive |
| Progress Card | "Progress: {percent}%" | polite |

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between cards |
| Enter | Select/confirm card action |
| Escape | Cancel/close card |
| Arrow keys | Navigate within card |
| Space | Toggle card expansion |

## Color & Contrast

| Element | Min Contrast | Pattern |
|---------|-------------|---------|
| Success | 4.5:1 | ✅ icon |
| Error | 4.5:1 | ❌ icon |
| Warning | 4.5:1 | ⚠️ icon |
| Info | 4.5:1 | ℹ️ icon |

## Motion

| Preference | Action |
|-----------|--------|
| `prefers-reduced-motion` | Disable animations |
| `prefers-reduced-motion` | Use opacity only |

---

# I. Architecture Impact

## New Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| `CardManager` | Manages card lifecycle | Critical |
| `CommandCard` | User input + preview | Critical |
| `ProcessCard` | Processing status | High |
| `ResultCard` | Final result | Critical |
| `RecoveryCard` | Error recovery | High |
| `ComparisonCard` | Multi-AI comparison | Medium |
| `ProgressCard` | Batch progress | Medium |
| `AuditCard` | History/traceability | Low |

## New Interfaces

```typescript
// Card Manager
interface CardManager {
  createCard(input: string): Card;
  updateCard(id: string, patch: Partial<Card>): void;
  deleteCard(id: string): void;
  getCard(id: string): Card;
  getCardsByUser(userId: string): Card[];
  getActiveCards(): Card[];
}

// Card Renderer
interface CardRenderer {
  render(card: Card): React.ReactNode;
  renderCompact(card: Card): React.ReactNode;
  renderExpanded(card: Card): React.ReactNode;
}

// Recovery Engine
interface RecoveryEngine {
  attemptRecovery(card: Card): Promise<RecoveryResult>;
  getRecoveryStrategies(error: Error): RecoveryStrategy[];
  executeStrategy(strategy: RecoveryStrategy): Promise<void>;
}
```

## Database Tables

```sql
-- Cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- command, process, result, recovery, error, progress, comparison, audit
  state TEXT NOT NULL, -- created, command, editing, processing, result, recovery, error, cancelled
  input TEXT NOT NULL,
  parsed_result JSONB,
  ai_results JSONB,
  confidence DECIMAL(3,2),
  request_id UUID,
  parent_id UUID REFERENCES cards(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE card_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id),
  action TEXT NOT NULL,
  detail TEXT,
  actor TEXT NOT NULL, -- user, system, ai
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# J. MVP / Later Priority

## ✅ ทำใน MVP

| Item | Reason |
|------|--------|
| Command Card (input + preview) | Core UX |
| Result Card (final result) | Core UX |
| Process Card (simple status) | User feedback |
| Recovery Card (basic error) | Error handling |
| Card lifecycle (basic states) | Data integrity |
| Swipe actions (confirm/cancel) | Mobile UX |
| Toast notifications (background tasks) | UX continuity |

## 🔧 เตรียม Architecture ไว้ตั้งแต่ต้น

| Item | Reason |
|------|--------|
| Card state machine | Extensible |
| Audit trail schema | Debugging |
| Recovery strategy pattern | Multi-provider |
| Confidence scoring | Quality |

## ⏳ ทำภายหลัง

| Item | Reason |
|------|--------|
| Comparison Card | ต้องมี multi-AI ก่อน |
| Progress Card | ต้องมี batch processing ก่อน |
| Audit Card (full) | ต้องมี data ก่อน |
| Advanced animations | Polish phase |
| Keyboard navigation | Accessibility phase |

---

## สรุป

> **หลักการออกแบบ Card-Based Interaction:**
>
> 1. **Card = Unit of Work** — ทุก action ของ user เป็น card หนึ่งใบ
> 2. **State Machine** — ทุก card มี lifecycle ชัดเจน
> 3. **Progressive Disclosure** — แสดงน้อย → detail ทีหลัง
> 4. **User is Source of Truth** — ทุก AI output ต้อง user confirm
> 5. **Silent Recovery** — แก้ปัญหาเบื้องหลัง แสดงผลสำเร็จ
> 6. **Audit Everything** — เก็บประวัติทุก step

---

**⚠️ ยังไม่ได้แก้ไข Specification ใด ๆ — รอ Review และ Approval**

**ขั้นตอนถัดไป:** รอการ review จากทีม แล้วจึงนำไปเขียน Card-Based Interaction Specification อย่างเป็นทางการ
