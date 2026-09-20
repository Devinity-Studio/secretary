# Card State Machine — Failure & Recovery States Analysis

> **สถานะ:** สำหรับ Review และ Approval เท่านั้น
>
> **วันที่:** 4 กันยายน 2026
>
> **วัตถุประสงค์:** วิเคราะห์ Card State Machine แบบละเอียด โดยเฉพาะ Failure & Recovery States

---

## 1. Complete State Diagram

```
                           ┌─────────────────────────────────────────────────┐
                           │                                                 │
                           │              ┌──────────────┐                   │
                           │              │   CREATED    │                   │
                           │              └──────┬───────┘                   │
                           │                     │                           │
                           │              user types input                   │
                           │                     │                           │
                           │                     ▼                           │
                           │              ┌──────────────┐                   │
                           │              │   COMMAND    │                   │
                           │              │  (Preview)   │                   │
                           │              └──────┬───────┘                   │
                           │                     │                           │
                           │          ┌──────────┼──────────┐               │
                           │          │          │          │               │
                           │     user edit   user confirm  user cancel     │
                           │          │          │          │               │
                           │          ▼          │          ▼               │
                           │   ┌──────────┐     │    ┌──────────┐         │
                           │   │ EDITING  │     │    │CANCELLED │         │
                           │   └────┬─────┘     │    └──────────┘         │
                           │        │           │                          │
                           │   user save        │                          │
                           │        │           │                          │
                           │        └───────────┤                          │
                           │                    │                          │
                           │                    ▼                          │
                           │             ┌──────────────┐                  │
                           │             │  PROCESSING  │                  │
                           │             └──────┬───────┘                  │
                           │                    │                          │
                           │       ┌────────────┼────────────┐            │
                           │       │            │            │            │
                           │    success      partial      all failed     │
                           │       │         success         │            │
                           │       │            │            │            │
                           │       ▼            ▼            ▼            │
                           │ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
                           │ │ RESULT   │ │ PARTIAL  │ │RECOVERING│      │
                           │ │(Success) │ │ SUCCESS  │ │          │      │
                           │ └──────────┘ └────┬─────┘ └────┬─────┘      │
                           │                   │            │             │
                           │              user review   ┌───┴───┐        │
                           │                   │        │       │        │
                           │                   ▼     retry   fallback   │
                           │              ┌──────────┐ │       │        │
                           │              │ WAITING  │ │       │        │
                           │              │  HUMAN   │ │       │        │
                           │              └──────────┘ │       │        │
                           │                           │       │        │
                           │                           ▼       ▼        │
                           │                    ┌──────────────────┐    │
                           │                    │     RETRYING     │    │
                           │                    └────────┬─────────┘    │
                           │                             │              │
                           │                    ┌────────┴────────┐    │
                           │                 success          failed   │
                           │                    │                 │    │
                           │                    ▼                 ▼    │
                           │             ┌──────────┐      ┌──────────┐│
                           │             │VERIFYING │      │FALLBACK  ││
                           │             └────┬─────┘      └────┬─────┘│
                           │                  │                  │     │
                           │             ┌────┴────┐            │     │
                           │          verified  failed          │     │
                           │             │         │            │     │
                           │             ▼         ▼            ▼     │
                           │      ┌──────────┐ ┌──────────┐ ┌──────────┐
                           │      │ RESULT   │ │RECOVERING│ │ RESULT   │
                           │      │(Verified)│ │ (again)  │ │(Fallback)│
                           │      └──────────┘ └──────────┘ └──────────┘
                           │
                           └─────────────────────────────────────────────────┘
```

---

## 2. State Definitions

### Primary States

| State | Description | System Action | User Action |
|-------|-------------|---------------|-------------|
| `CREATED` | Card ถูกสร้างขึ้น | Initialize | None |
| `COMMAND` | แสดง preview ให้ user ยืนยัน | Parse input | Confirm / Edit / Cancel |
| `EDITING` | User กำลังแก้ไข | Wait | Edit fields |
| `PROCESSING` | กำลังส่ง AI / ประมวลผล | Execute AI requests | Cancel only |
| `RESULT` | บันทึกสำเร็จ | Save to DB | View / Edit / Delete |
| `CANCELLED` | User ยกเลิก | Cleanup | None |

### Failure & Recovery States

| State | Description | System Action | User Action |
|-------|-------------|---------------|-------------|
| `PARTIAL_SUCCESS` | บางส่วนสำเร็จ บางส่วนล้มเหลว | Show per-item status | Review / Retry failed / Cancel |
| `RECOVERING` | กำลังกู้คืนจาก error | Execute recovery strategy | Wait / Cancel |
| `RETRYING` | กำลังลองใหม่ | Retry with backoff | Wait / Cancel |
| `FALLBACK` | ใช้ระบบสำรอง (rule-based) | Execute fallback | Confirm / Edit |
| `VERIFYING` | ตรวจสอบผลลัพธ์ | Cross-validate | Wait |
| `WAITING_HUMAN` | ต้องการ human intervention | Notify user | Choose action |

---

## 3. State Transitions — Detailed

### 3.1 Normal Flow

```
CREATED
  │
  │ user types input
  ▼
COMMAND ←──────────────┐
  │                    │
  │ user confirm       │ user edit
  ▼                    │
PROCESSING ──────→ EDITING ──────┘
  │
  │ success
  ▼
RESULT
```

### 3.2 Failure Flow — Recovering

```
PROCESSING
  │
  │ AI failed
  ▼
RECOVERING
  │
  │ strategy: retry
  ▼
RETRYING
  │
  │ success
  ▼
VERIFYING
  │
  │ verified
  ▼
RESULT
```

### 3.3 Failure Flow — Fallback

```
PROCESSING
  │
  │ all AI failed
  ▼
RECOVERING
  │
  │ strategy: fallback
  ▼
FALLBACK
  │
  │ rule-based success
  ▼
VERIFYING
  │
  │ verified
  ▼
RESULT
```

### 3.4 Failure Flow — Waiting Human

```
PROCESSING
  │
  │ ambiguous result / conflict
  ▼
WAITING_HUMAN
  │
  │ user chooses
  ▼
COMMAND (editable)
  │
  │ user confirms
  ▼
RESULT
```

### 3.5 Partial Success Flow

```
PROCESSING (batch)
  │
  │ some success, some failed
  ▼
PARTIAL_SUCCESS
  │
  │ user reviews
  ▼
┌─────────────────────────────────────┐
│ Per-item:                          │
│ ✅ Item 1 → RESULT                 │
│ ❌ Item 2 → RETRYING → RESULT      │
│ ❌ Item 3 → FALLBACK → RESULT      │
│ ⚠️ Item 4 → WAITING_HUMAN          │
└─────────────────────────────────────┘
```

### 3.6 Cancelled Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ COMMAND  │     │PROCESSING│     │RECOVERING│
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     │ user cancel    │ user cancel    │ user cancel
     ▼                ▼                ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│CANCELLED │     │CANCELLED │     │CANCELLED │
└──────────┘     └──────────┘     └──────────┘
```

---

## 4. Recovery Strategy Execution

### 4.1 Recovery State Machine

```
RECOVERING
    │
    │ select strategy
    ▼
┌─────────────────────────────────────────────┐
│           STRATEGY SELECTION                │
├─────────────────────────────────────────────┤
│                                             │
│  1. Retry (same provider)                   │
│     ↓                                       │
│  2. Retry (different provider)              │
│     ↓                                       │
│  3. Fallback (rule-based)                   │
│     ↓                                       │
│  4. Manual input                            │
│     ↓                                       │
│  5. Wait for human                          │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 Retry Flow

```
RETRYING
    │
    │ attempt #1
    ▼
┌──────────────────┐
│ Retry #1         │
│ Provider: Dev8   │
│ Status: ⏳       │
└────────┬─────────┘
         │
    ┌────┴────┐
 success   failed
    │         │
    ▼         ▼
VERIFYING   RETRYING
              │
              │ attempt #2
              ▼
         ┌──────────────────┐
         │ Retry #2         │
         │ Provider: Free   │
         │ Status: ⏳       │
         └────────┬─────────┘
                  │
             ┌────┴────┐
          success    failed
             │         │
             ▼         ▼
        VERIFYING   FALLBACK
```

### 4.3 Fallback Flow

```
FALLBACK
    │
    │ execute rule-based parser
    ▼
┌──────────────────┐
│ Rule-based       │
│ Parsing...       │
└────────┬─────────┘
         │
    ┌────┴────┐
 success    failed
    │         │
    ▼         ▼
VERIFYING   WAITING_HUMAN
```

### 4.4 Verification Flow

```
VERIFYING
    │
    │ cross-validate
    ▼
┌──────────────────┐
│ Compare:         │
│ • AI result      │
│ • Rule-based     │
│ • User history   │
└────────┬─────────┘
         │
    ┌────┴────┐
 match     mismatch
    │         │
    ▼         ▼
RESULT    WAITING_HUMAN
```

---

## 5. Partial Success — Detailed

### Scenario: Batch of 3 items

```
Input: "กาแฟ 65, เงินเดือน 28000, โอนออม 5000"
```

### Processing

```
PROCESSING (batch)
    │
    │ Item 1: กาแฟ 65
    │   → Dev8: ✅ success
    │   → Free: ✅ success
    │   → Result: expense ฿65
    │
    │ Item 2: เงินเดือน 28000
    │   → Dev8: ✅ success
    │   → Free: ✅ success
    │   → Result: income ฿28,000
    │
    │ Item 3: โอนออม 5000
    │   → Dev8: ❌ timeout
    │   → Free: ❌ rate limited
    │   → Rule: ❌ ambiguous
    │
    ▼
PARTIAL_SUCCESS
```

### UI Display

```
┌─────────────────────────────────────────┐
│ 📊 Partial Success                      │
├─────────────────────────────────────────┤
│                                         │
│ ✅ กาแฟ 65 — สำเร็จ                    │
│    รายจ่าย ฿65 · อาหาร · เงินสด        │
│                                         │
│ ✅ เงินเดือน 28000 — สำเร็จ             │
│    รายรับ ฿28,000 · เงินเดือน · กสิกร   │
│                                         │
│ ❌ โอนออม 5000 — ล้มเหลว              │
│    ปัญหา: AI ไม่แน่ใจว่าเป็นโอนหรือจ่าย  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ สำเร็จ 2/3 รายการ (67%)            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 สำหรับรายการที่ล้มเหลว:              │
│ [ ลองใหม่ ]  [ แก้ไขเอง ]  [ ข้าม ]   │
└─────────────────────────────────────────┘
```

### User Actions

| Action | Result |
|--------|--------|
| ลองใหม่ | Retry failed items → PROCESSING |
| แก้ไขเอง | Open editable form → COMMAND |
| ข้าม | Skip failed items → RESULT (partial) |

---

## 6. Cancelled — Detailed

### When Can User Cancel?

| State | Cancel Available | What Happens |
|-------|-----------------|--------------|
| `CREATED` | N/A | Card not yet visible |
| `COMMAND` | ✅ | Card → CANCELLED |
| `EDITING` | ✅ | Card → CANCELLED |
| `PROCESSING` | ✅ | Abort AI requests → CANCELLED |
| `RECOVERING` | ✅ | Abort recovery → CANCELLED |
| `RETRYING` | ✅ | Abort retry → CANCELLED |
| `RESULT` | ❌ | Must use delete |

### Cancel Behavior

```
┌─────────────────────────────────────────────────────┐
│                    CANCEL FLOW                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  User taps "ยกเลิก"                                 │
│       │                                             │
│       ▼                                             │
│  ┌─────────────────────────────────────┐            │
│  │ Confirm Dialog                      │            │
│  │ "ยกเลิกรายการนี้?"                  │            │
│  │                                     │            │
│  │ [ยกเลิก]        [ยืนยันยกเลิก]      │            │
│  └─────────────────────────────────────┘            │
│       │                                             │
│       │ user confirms                               │
│       ▼                                             │
│  ┌─────────────────────────────────────┐            │
│  │ Cleanup:                            │            │
│  │ • Abort pending AI requests         │            │
│  │ • Clear timeout timers              │            │
│  │ • Remove from active cards          │            │
│  │ • Log cancellation event            │            │
│  └─────────────────────────────────────┘            │
│       │                                             │
│       ▼                                             │
│  Card removed from view                             │
│  (or moved to history)                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 7. Waiting Human — Detailed

### When Does System Wait for Human?

| Scenario | Reason | System Action |
|----------|--------|---------------|
| AI conflict | Multiple AI give different results | Show comparison, wait for choice |
| Ambiguous input | System can't determine intent | Show options, wait for clarification |
| Low confidence | AI not sure about result | Show preview, ask for confirmation |
| Financial anomaly | Unusual amount/category | Flag for review |
| Recovery exhausted | All strategies failed | Ask user what to do |

### UI Display

```
┌─────────────────────────────────────────┐
│ 🙋 Waiting for You                      │
├─────────────────────────────────────────┤
│                                         │
│ "จ่ายค่าไฟ 1,200"                      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ปัญหา: ไม่แน่ใจว่าเป็น              │ │
│ │ • รายจ่ายค่าไฟ                     │ │
│ │ • โอนเงินเข้าบัญชีค่าไฟ             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 กรุณาเลือก:                          │
│                                         │
│ [ รายจ่าย ฿1,200 ]                     │
│ [ โอนเงิน ฿1,200 → บัญชีค่าไฟ ]       │
│ [ แก้ไขเอง ]                           │
│                                         │
└─────────────────────────────────────────┘
```

### Timeout Behavior

```
WAITING_HUMAN
    │
    │ user doesn't respond for 5 minutes
    ▼
┌─────────────────────────────────────┐
│ Reminder Notification               │
│ "คุณมีรายการรอการยืนยัน"            │
└─────────────────────────────────────┘
    │
    │ user doesn't respond for 30 minutes
    ▼
┌─────────────────────────────────────┐
│ Auto-save as draft                  │
│ "บันทึกเป็นฉบับร่าง"                │
└─────────────────────────────────────┘
```

---

## 8. Verification — Detailed

### What Gets Verified?

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Type match | AI vs rule-based | Same type (expense/income/transfer) |
| Amount match | AI vs rule-based | Same amount (±1%) |
| Category match | AI vs rule-based | Same or similar category |
| Account match | AI vs user history | Valid account exists |
| Date match | AI vs rule-based | Same date |

### Verification UI (Hidden by Default)

```
┌─────────────────────────────────────────┐
│ ✅ Result Card (Verified)               │
├─────────────────────────────────────────┤
│ 💰 รายจ่าย · กาแฟมื้อเช้า              │
│ ฿65.00                                 │
│ 📅 วันนี้ · 🏦 เงินสด · 🏷️ อาหาร      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ Verified: AI + Rule-based match  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ แก้ไข ]  [ ลบ ]  [ ดูรายละเอียด ]    │
└─────────────────────────────────────────┘
```

### Verification Failed

```
┌─────────────────────────────────────────┐
│ ⚠️ Result Card (Verification Failed)    │
├─────────────────────────────────────────┤
│ 💰 รายจ่าย · กาแฟมื้อเช้า              │
│ ฿65.00                                 │
│ 📅 วันนี้ · 🏦 เงินสด · 🏷️ อาหาร      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠️ AI: expense ฿65                  │ │
│ │ ⚠️ Rule: expense ฿60                │ │
│ │                                     │ │
│ │ จำนวนเงินต่างกัน                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 กรุณายืนยันจำนวนเงิน:              │
│ [ ฿65 (AI) ]  [ ฿60 (Rule) ]  [แก้ไข] │
└─────────────────────────────────────────┘
```

---

## 9. Card Properties — Extended

```typescript
interface Card {
  // Core
  id: string;
  type: CardType;
  state: CardState;
  
  // Data
  input: string;
  parsedResult?: ParsedResult;
  aiResults?: AIResult[];
  
  // State machine
  previousState?: CardState;
  stateHistory: StateTransition[];
  
  // Recovery
  recoveryStrategy?: RecoveryStrategy;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  
  // Verification
  verified: boolean;
  verificationResult?: VerificationResult;
  
  // Partial success
  batchItems?: BatchItem[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  userId: string;
  
  // Linking
  requestId?: string;
  parentId?: string;
  childIds?: string[];
  
  // Audit
  auditTrail: AuditEntry[];
}

type CardType = 
  | 'command' 
  | 'process' 
  | 'result' 
  | 'recovery' 
  | 'error' 
  | 'progress' 
  | 'comparison' 
  | 'audit';

type CardState = 
  | 'created'
  | 'command'
  | 'editing'
  | 'processing'
  | 'result'
  | 'cancelled'
  | 'partial_success'
  | 'recovering'
  | 'retrying'
  | 'fallback'
  | 'verifying'
  | 'waiting_human';

interface StateTransition {
  from: CardState;
  to: CardState;
  timestamp: string;
  trigger: 'user' | 'system' | 'timeout';
  detail?: string;
}

interface BatchItem {
  id: string;
  input: string;
  state: CardState;
  result?: ParsedResult;
  error?: string;
}

interface VerificationResult {
  match: boolean;
  checks: VerificationCheck[];
}

interface VerificationCheck {
  field: string;
  aiValue: any;
  ruleValue: any;
  match: boolean;
}

type RecoveryStrategy = 
  | 'retry_same_provider'
  | 'retry_different_provider'
  | 'fallback_rule_based'
  | 'manual_input'
  | 'wait_for_human';
```

---

## 10. State Transition Rules

### Valid Transitions

| From | To | Trigger | Condition |
|------|----|---------|-----------|
| `CREATED` | `COMMAND` | system | Input parsed |
| `COMMAND` | `EDITING` | user | Tap edit |
| `COMMAND` | `PROCESSING` | user | Tap confirm |
| `COMMAND` | `CANCELLED` | user | Tap cancel |
| `EDITING` | `COMMAND` | user | Save edit |
| `EDITING` | `CANCELLED` | user | Tap cancel |
| `PROCESSING` | `RESULT` | system | All success |
| `PROCESSING` | `PARTIAL_SUCCESS` | system | Some success |
| `PROCESSING` | `RECOVERING` | system | All failed |
| `PROCESSING` | `WAITING_HUMAN` | system | Ambiguous |
| `PROCESSING` | `CANCELLED` | user | Tap cancel |
| `RECOVERING` | `RETRYING` | system | Strategy: retry |
| `RECOVERING` | `FALLBACK` | system | Strategy: fallback |
| `RECOVERING` | `WAITING_HUMAN` | system | No strategy left |
| `RECOVERING` | `CANCELLED` | user | Tap cancel |
| `RETRYING` | `VERIFYING` | system | Retry success |
| `RETRYING` | `RECOVERING` | system | Retry failed |
| `RETRYING` | `CANCELLED` | user | Tap cancel |
| `FALLBACK` | `VERIFYING` | system | Fallback success |
| `FALLBACK` | `WAITING_HUMAN` | system | Fallback failed |
| `VERIFYING` | `RESULT` | system | Verified |
| `VERIFYING` | `WAITING_HUMAN` | system | Verification failed |
| `WAITING_HUMAN` | `COMMAND` | user | User chooses |
| `WAITING_HUMAN` | `CANCELLED` | user | Tap cancel |
| `PARTIAL_SUCCESS` | `RETRYING` | user | Retry failed items |
| `PARTIAL_SUCCESS` | `RESULT` | user | Skip failed items |

### Invalid Transitions (Guard)

```
❌ Cannot go from RESULT to PROCESSING
❌ Cannot go from CANCELLED to any state
❌ Cannot go from COMMAND to RESULT (must process first)
❌ Cannot go from WAITING_HUMAN to RESULT (must get human input)
```

---

## 11. Timeout Rules

| State | Timeout | Action |
|-------|---------|--------|
| `PROCESSING` | 30 seconds | → RECOVERING |
| `RECOVERING` | 10 seconds per strategy | Try next strategy |
| `RETRYING` | 15 seconds per attempt | → RECOVERING (next strategy) |
| `VERIFYING` | 5 seconds | → RESULT (accept) |
| `WAITING_HUMAN` | 5 minutes | Reminder notification |
| `WAITING_HUMAN` | 30 minutes | Auto-save as draft |

---

## 12. UI States Summary

### Card Visual by State

| State | Icon | Color | Action Button |
|-------|------|-------|---------------|
| `CREATED` | — | — | — |
| `COMMAND` | 💬 | Blue | [แก้ไข] [ยืนยัน] [ยกเลิก] |
| `EDITING` | ✏️ | Yellow | [บันทึก] [ยกเลิก] |
| `PROCESSING` | ⏳ | Blue (animated) | [ยกเลิก] |
| `RESULT` | ✅ | Green | [แก้ไข] [ลบ] |
| `CANCELLED` | ❌ | Gray | — |
| `PARTIAL_SUCCESS` | ⚠️ | Orange | [ลองใหม่] [แก้ไข] [ข้าม] |
| `RECOVERING` | 🔧 | Orange (animated) | [ยกเลิก] |
| `RETRYING` | 🔄 | Blue (animated) | [ยกเลิก] |
| `FALLBACK` | 🛠️ | Yellow | [ยืนยัน] [แก้ไข] |
| `VERIFYING` | 🔍 | Blue (animated) | — |
| `WAITING_HUMAN` | 🙋 | Purple | [เลือก] |

---

## 13. Summary

> **Card State Machine ต้องรองรับ:**
>
> 1. **Normal flow:** CREATED → COMMAND → PROCESSING → RESULT
> 2. **Recovery flow:** PROCESSING → RECOVERING → RETRYING/FALLBACK → VERIFYING → RESULT
> 3. **Partial success:** PROCESSING → PARTIAL_SUCCESS → per-item resolution
> 4. **Human escalation:** PROCESSING → WAITING_HUMAN → user action → RESULT
> 5. **Cancellation:** Any active state → CANCELLED
>
> **หลักการออกแบบ:**
> - ทุก state ต้องมี exit condition ชัดเจน
> - ทุก state transition ต้อง log ไว้
> - User ต้องสามารถ cancel ได้จากทุก active state
> - System ต้อง retry อย่างน้อย 1 ครั้งก่อน escalat