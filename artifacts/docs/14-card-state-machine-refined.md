# Card State Machine — Refined Analysis (v2)

> **สถานะ:** สำหรับ Review และ Approval เท่านั้น
>
> **วันที่:** 4 กันยายน 2026
>
> **Version:** 2.0 (Refined from v1)
>
> **Changes:** Validation Gate, Human Decision Flow, Failure-Specific Recovery

---

## สารบัญ

- [1. VERIFYING as Validation Gate](#1-verifying-as-validation-gate)
- [2. WAITING_HUMAN — Human Decision Flow](#2-waiting_human--human-decision-flow)
- [3. Failure-Specific Recovery Strategy](#3-failure-specific-recovery-strategy)
- [4. Updated State Diagram](#4-updated-state-diagram)
- [5. Summary of Changes](#5-summary-of-changes)

---

# 1. VERIFYING as Validation Gate

## หลักการออกแบบ

> **VERIFYING ไม่ใช่ "รอผล" แต่เป็น "Gate" ที่ต้องตัดสินใจ**
>
> ทุกครั้งที่VERIFYING ต้องมีผลลัพธ์ชัดเจน: Valid / Invalid / Cannot Verify

## Verification Decision Tree

```
VERIFYING
    │
    │ run validation checks
    ▼
┌─────────────────────────────────────────────────────────┐
│                  VERIFICATION GATE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Check 1: Schema Validation                             │
│  ├── Pass → Continue                                    │
│  └── Fail → INVALID                                     │
│                                                         │
│  Check 2: Business Rules                                │
│  ├── Pass → Continue                                    │
│  └── Fail → INVALID                                     │
│                                                         │
│  Check 3: Cross-validation (AI vs Rule-based)           │
│  ├── Match → VERIFIED                                   │
│  ├── Mismatch → Check severity                          │
│  │   ├── Minor (±5%) → VERIFIED (with warning)          │
│  │   └── Major (>5%) → UNCERTAIN                        │
│  └── Cannot compare → UNCERTAIN                         │
│                                                         │
│  Check 4: Anomaly Detection                             │
│  ├── Normal → VERIFIED                                  │
│  ├── Suspicious → UNCERTAIN                             │
│  └── Anomaly → WAITING_HUMAN                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
    │
    ├── VERIFIED → RESULT
    ├── INVALID → RECOVERING
    └── UNCERTAIN → WAITING_HUMAN
```

## Verification Outcomes

| Outcome | Condition | Next State | System Action |
|---------|-----------|------------|---------------|
| `VERIFIED` | All checks pass | `RESULT` | Save to DB |
| `VERIFIED_WITH_WARNING` | Minor mismatch | `RESULT` | Save + flag |
| `INVALID` | Schema/business rule fail | `RECOVERING` | Retry with correction |
| `UNCERTAIN` | Cannot determine correctness | `WAITING_HUMAN` | Ask user |
| `ANOMALY` | Unusual pattern detected | `WAITING_HUMAN` | Flag for review |

## Verification Checks — Detailed

### Check 1: Schema Validation

```typescript
interface SchemaCheck {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'enum';
  validator: (value: any) => boolean;
}

// Example
const schemaChecks: SchemaCheck[] = [
  { field: 'type', required: true, type: 'enum', validator: v => ['expense', 'income', 'transfer'].includes(v) },
  { field: 'amount', required: true, type: 'number', validator: v => v > 0 && v < 10000000 },
  { field: 'date', required: true, type: 'date', validator: v => !isNaN(Date.parse(v)) },
  { field: 'accountId', required: true, type: 'string', validator: v => v.length > 0 },
];
```

### Check 2: Business Rules

```typescript
interface BusinessRule {
  name: string;
  check: (result: ParsedResult, context: UserContext) => boolean;
}

const businessRules: BusinessRule[] = [
  {
    name: 'transfer_must_have_two_accounts',
    check: (r, ctx) => r.type !== 'transfer' || (r.toAccountId && r.toAccountId !== r.accountId)
  },
  {
    name: 'amount_must_be_reasonable',
    check: (r, ctx) => r.amount <= ctx.userAverageTransaction * 10
  },
  {
    name: 'date_cannot_be_future',
    check: (r, ctx) => new Date(r.date) <= new Date()
  },
];
```

### Check 3: Cross-validation

```typescript
interface CrossValidationResult {
  match: boolean;
  field: string;
  aiValue: any;
  ruleValue: any;
  difference: number; // percentage
  severity: 'minor' | 'major';
}

function crossValidate(aiResult: ParsedResult, ruleResult: ParsedResult): CrossValidationResult[] {
  const checks: CrossValidationResult[] = [];
  
  // Type check
  checks.push({
    match: aiResult.type === ruleResult.type,
    field: 'type',
    aiValue: aiResult.type,
    ruleValue: ruleResult.type,
    difference: aiResult.type === ruleResult.type ? 0 : 100,
    severity: 'major'
  });
  
  // Amount check
  const amountDiff = Math.abs(aiResult.amount - ruleResult.amount) / ruleResult.amount * 100;
  checks.push({
    match: amountDiff < 5,
    field: 'amount',
    aiValue: aiResult.amount,
    ruleValue: ruleResult.amount,
    difference: amountDiff,
    severity: amountDiff < 5 ? 'minor' : 'major'
  });
  
  return checks;
}
```

### Check 4: Anomaly Detection

```typescript
interface AnomalyCheck {
  type: 'amount' | 'frequency' | 'category' | 'time';
  detected: boolean;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

function detectAnomalies(result: ParsedResult, history: Transaction[]): AnomalyCheck[] {
  const anomalies: AnomalyCheck[] = [];
  
  // Amount anomaly
  const avgAmount = history.reduce((s, t) => s + t.amount, 0) / history.length;
  if (result.amount > avgAmount * 5) {
    anomalies.push({
      type: 'amount',
      detected: true,
      severity: 'high',
      reason: `Amount ฿${result.amount} is ${Math.round(result.amount / avgAmount)}x higher than average`
    });
  }
  
  // Frequency anomaly
  const todayCount = history.filter(t => t.date === todayISO()).length;
  if (todayCount > 20) {
    anomalies.push({
      type: 'frequency',
      detected: true,
      severity: 'medium',
      reason: `Unusually high transaction count today: ${todayCount}`
    });
  }
  
  return anomalies;
}
```

## VERIFYING → Invalid → RECOVERING Flow

```
VERIFYING
    │
    │ validation failed
    ▼
RECOVERING
    │
    │ select strategy based on failure type
    ▼
┌─────────────────────────────────────────┐
│ Strategy Selection                      │
│                                         │
│ Schema fail → Retry with stricter prompt│
│ Business rule fail → Correct & retry    │
│ Cross-validation fail → Use rule-based  │
│ Anomaly → Wait for human                │
└─────────────────────────────────────────┘
```

---

# 2. WAITING_HUMAN — Human Decision Flow

## หลักการออกแบบ

> **Human Decision ควรเป็น Event/Action ไม่ใช่ State แยกต่างหาก**
>
> เพราะ human action เป็น "trigger" ที่ทำให้ state เปลี่ยน ไม่ใช่ "สถานะ" ที่ค้างอยู่

## Updated Design: Human Decision as Action

```
WAITING_HUMAN
    │
    │ human takes action
    ▼
┌─────────────────────────────────────────────────────────┐
│                  HUMAN DECISIONS                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Action 1: APPROVE                                      │
│  ├── "ผลลัพธ์ถูกต้อง"                                   │
│  └── → RESULT (save as-is)                              │
│                                                         │
│  Action 2: MODIFY                                       │
│  ├── "แก้ไขเล็กน้อย"                                    │
│  └── → COMMAND (editable) → user edit → PROCESSING     │
│                                                         │
│  Action 3: REJECT                                       │
│  ├── "ผลลัพธ์ผิดทั้งหมด"                                │
│  └── → CANCELLED                                        │
│                                                         │
│  Action 4: PROVIDE_INFO                                 │
│  ├── "ให้ข้อมูลเพิ่ม"                                   │
│  └── → PROCESSING (with new info)                       │
│                                                         │
│  Action 5: CHOOSE_ALTERNATIVE                           │
│  ├── "เลือกผลลัพธ์อื่น"                                  │
│  └── → RESULT (with chosen option)                      │
│                                                         │
│  Action 6: CANCEL                                       │
│  ├── "ไม่เอาแล้ว"                                       │
│  └── → CANCELLED                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Human Decision Flow — Detailed

### Action 1: APPROVE

```
WAITING_HUMAN
    │
    │ user: " approve "
    ▼
┌─────────────────────────────────────┐
│ System:                             │
│ • Log approval event                │
│ • Save result to DB                 │
│ • → RESULT                          │
└─────────────────────────────────────┘
```

### Action 2: MODIFY

```
WAITING_HUMAN
    │
    │ user: " modify "
    ▼
┌─────────────────────────────────────┐
│ Show editable form with current     │
│ result pre-filled                   │
│                                     │
│ User edits fields                   │
│                                     │
│ User saves                          │
│     │                               │
│     ▼                               │
│ PROCESSING (re-validate)            │
│     │                               │
│     ▼                               │
│ VERIFYING → RESULT                  │
└─────────────────────────────────────┘
```

### Action 3: REJECT

```
WAITING_HUMAN
    │
    │ user: " reject "
    ▼
┌─────────────────────────────────────┐
│ System:                             │
│ • Log rejection event               │
│ • Remove card                       │
│ • → CANCELLED                       │
└─────────────────────────────────────┘
```

### Action 4: PROVIDE_INFO

```
WAITING_HUMAN
    │
    │ user: " provide more info "
    ▼
┌─────────────────────────────────────┐
│ Show input form for additional info │
│                                     │
│ User provides:                      │
│ • Clarification                     │
│ • Missing data                      │
│ • Context                           │
│                                     │
│ User submits                        │
│     │                               │
│     ▼                               │
│ PROCESSING (re-process with info)   │
│     │                               │
│     ▼                               │
│ VERIFYING → RESULT                  │
└─────────────────────────────────────┘
```

### Action 5: CHOOSE_ALTERNATIVE

```
WAITING_HUMAN
    │
    │ user: " choose alternative "
    ▼
┌─────────────────────────────────────┐
│ Show all available options:         │
│ • AI result A                       │
│ • AI result B                       │
│ • Rule-based result                 │
│ • Manual input                      │
│                                     │
│ User selects one                    │
│     │                               │
│     ▼                               │
│ RESULT (with selected option)       │
└─────────────────────────────────────┘
```

### Action 6: CANCEL

```
WAITING_HUMAN
    │
    │ user: " cancel "
    ▼
┌─────────────────────────────────────┐
│ System:                             │
│ • Log cancel event                  │
│ • Cleanup                           │
│ • → CANCELLED                       │
└─────────────────────────────────────┘
```

## WAITING_HUMAN Timeout Behavior

```
WAITING_HUMAN
    │
    │ 5 minutes elapsed
    ▼
┌─────────────────────────────────────┐
│ Reminder Notification               │
│ "คุณมีรายการรอการยืนยัน"            │
│                                     │
│ [ ยืนยัน ]  [ ดูทีหลัง ]           │
└─────────────────────────────────────┘
    │
    │ 30 minutes elapsed (no response)
    ▼
┌─────────────────────────────────────┐
│ Auto-save as Draft                  │
│                                     │
│ System:                             │
│ • Save current state as draft       │
│ • → DRAFT (new terminal state)      │
│ • User can resume later             │
└─────────────────────────────────────┘
```

---

# 3. Failure-Specific Recovery Strategy

## หลักการออกแบบ

> **Recovery Strategy ต้องเป็น Generic Framework**
>
> แต่ละ Failure Type กำหนด strategy chain ของตัวเอง

## Failure Type Registry

```typescript
interface FailureType {
  id: string;
  name: string;
  description: string;
  detectable: (error: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  strategies: RecoveryStrategy[];
}

interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  execute: (context: RecoveryContext) => Promise<RecoveryResult>;
  timeout: number; // ms
  maxAttempts: number;
  nextStrategyOnFail?: string; // strategy id
}

interface RecoveryContext {
  card: Card;
  failureType: FailureType;
  attempt: number;
  previousResults: RecoveryResult[];
  userContext: UserContext;
}

interface RecoveryResult {
  success: boolean;
  strategyId: string;
  attempt: number;
  result?: ParsedResult;
  error?: string;
  duration: number;
}
```

## Failure Types & Strategy Chains

### FT01: API Timeout

```
Failure: API Timeout
├── Detect: Response time > 5000ms
├── Severity: Medium
└── Strategies:
    1. Retry Same Provider (3s timeout, max 2 attempts)
    2. Retry Different Provider (5s timeout, max 1 attempt)
    3. Fallback Rule-based (immediate)
    4. Wait for Human
```

### FT02: Rate Limited (429)

```
Failure: Rate Limited
├── Detect: HTTP 429
├── Severity: Medium
└── Strategies:
    1. Wait & Retry (exponential backoff: 1s, 2s, 4s)
    2. Switch Provider (if available)
    3. Queue for Later (if batch)
    4. Fallback Rule-based
    5. Wait for Human
```

### FT03: Quota Exceeded

```
Failure: Quota Exceeded
├── Detect: Quota error response
├── Severity: High
└── Strategies:
    1. Switch to Free Tier Provider
    2. Fallback Rule-based
    3. Wait for Human (inform quota status)
```

### FT04: Invalid JSON Response

```
Failure: Invalid JSON
├── Detect: JSON.parse failure
├── Severity: Medium
└── Strategies:
    1. JSON Repair (fix common issues)
    2. Retry with Stricter Prompt
    3. Switch Provider
    4. Fallback Rule-based
```

### FT05: Schema Validation Fail

```
Failure: Schema Invalid
├── Detect: Validation error
├── Severity: Medium
└── Strategies:
    1. Retry with Schema in Prompt
    2. Retry with Few-shot Examples
    3. Fallback Rule-based
    4. Wait for Human
```

### FT06: AI Conflict (Multiple Results Disagree)

```
Failure: AI Conflict
├── Detect: Results from different AI differ significantly
├── Severity: Medium
└── Strategies:
    1. Cross-validation with Rule-based
    2. Confidence-weighted Selection
    3. Re-analyze with Combined Context
    4. Wait for Human (show comparison)
```

### FT07: AI Unavailable (Provider Down)

```
Failure: Provider Down
├── Detect: Connection refused, 503
├── Severity: High
└── Strategies:
    1. Circuit Breaker (skip provider)
    2. Switch Provider
    3. Fallback Rule-based
    4. Wait for Human
```

### FT08: Financial Uncertainty

```
Failure: Financial Uncertainty
├── Detect: Amount anomaly, unusual category
├── Severity: Critical
└── Strategies:
    1. Flag for Review (immediate)
    2. Wait for Human (require confirmation)
    3. NO automatic fallback (financial safety)
```

### FT09: Network Error

```
Failure: Network Error
├── Detect: Fetch error, DNS failure
├── Severity: High
└── Strategies:
    1. Retry (3 attempts, 2s interval)
    2. Check Network Status
    3. Fallback Rule-based (offline capable)
    4. Wait for Human
```

### FT10: Unknown Error

```
Failure: Unknown
├── Detect: Catch-all
├── Severity: Medium
└── Strategies:
    1. Log Error Details
    2. Retry Once
    3. Fallback Rule-based
    4. Wait for Human (with error details)
```

## Strategy Chain Execution

```
RECOVERING
    │
    │ failureType detected
    ▼
┌─────────────────────────────────────────────────────────┐
│              STRATEGY CHAIN EXECUTION                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Select strategy chain from FailureType              │
│                                                         │
│  2. Execute strategy[0]                                 │
│     ├── Success → VERIFYING                             │
│     └── Fail → Continue                                 │
│                                                         │
│  3. Execute strategy[1]                                 │
│     ├── Success → VERIFYING                             │
│     └── Fail → Continue                                 │
│                                                         │
│  4. Execute strategy[2]                                 │
│     ├── Success → VERIFYING                             │
│     └── Fail → Continue                                 │
│                                                         │
│  5. ... until strategy chain exhausted                  │
│                                                         │
│  6. All strategies failed → WAITING_HUMAN               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Strategy Selection Algorithm

```typescript
function selectStrategy(
  failureType: FailureType,
  context: RecoveryContext
): RecoveryStrategy | null {
  // Get available strategies for this failure type
  const strategies = failureType.strategies;
  
  // Filter by context
  const available = strategies.filter(s => {
    // Check if strategy is applicable
    if (s.id === 'switch_provider' && !hasAlternateProvider(context)) return false;
    if (s.id === 'queue' && !isBatch(context)) return false;
    return true;
  });
  
  // Select based on attempt count
  const attempt = context.attempt;
  if (attempt < available.length) {
    return available[attempt];
  }
  
  // All strategies exhausted
  return null;
}
```

## Recovery State Machine (Updated)

```
RECOVERING
    │
    │ detect failure type
    ▼
┌─────────────────────────────────────┐
│ Select Strategy Chain               │
│ (based on FailureType)              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Execute Strategy[0]                 │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
 success    failed
    │         │
    ▼         ▼
VERIFYING   ┌─────────────────────────┐
            │ Execute Strategy[1]     │
            └────────┬────────────────┘
                     │
                ┌────┴────┐
             success    failed
                │         │
                ▼         ▼
           VERIFYING   ┌─────────────────────────┐
                       │ Execute Strategy[2]     │
                       └────────┬────────────────┘
                                │
                           ┌────┴────┐
                        success    failed
                           │         │
                           ▼         ▼
                      VERIFYING   WAITING_HUMAN
```

---

# 4. Updated State Diagram

## Complete State Diagram (v2)

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
                           │              user review   failure type     │
                           │                   │        detected         │
                           │                   │            │             │
                           │                   │            ▼             │
                           │                   │  ┌───────────────────┐  │
                           │                   │  │ STRATEGY CHAIN    │  │
                           │                   │  │ EXECUTION         │  │
                           │                   │  └────────┬──────────┘  │
                           │                   │           │              │
                           │                   │      ┌────┴────┐       │
                           │                   │   success    failed    │
                           │                   │      │         │       │
                           │                   │      ▼         │       │
                           │                   │ ┌──────────┐   │       │
                           │                   │ │VERIFYING │   │       │
                           │                   │ └────┬─────┘   │       │
                           │                   │      │         │       │
                           │                   │ ┌────┴────┐    │       │
                           │                   │ │ GATE    │    │       │
                           │                   │ └────┬─────┘    │       │
                           │                   │      │          │       │
                           │                   │  ┌───┴───┐      │       │
                           │                   │  │       │      │       │
                           │                   │ verified│      │       │
                           │                   │  │  invalid   uncertain │
                           │                   │  │       │      │       │
                           │                   │  ▼       │      │       │
                           │                   │ RESULT   │      │       │
                           │                   │          ▼      ▼       │
                           │                   │      RECOVERING │       │
                           │                   │          │      │       │
                           │                   │          │      ▼       │
                           │                   │          │ WAITING_HUMAN│
                           │                   │          │      │       │
                           │                   │          │      │       │
                           │                   │          │  ┌───┴───┐   │
                           │                   │          │  │human  │   │
                           │                   │          │  │action │   │
                           │                   │          │  └───┬───┘   │
                           │                   │          │      │       │
                           │                   │          │  ┌───┴───────────────────┐
                           │                   │          │  │                       │
                           │                   │          │  │ approve → RESULT      │
                           │                   │          │  │ modify → COMMAND      │
                           │                   │          │  │ reject → CANCELLED    │
                           │                   │          │  │ provide_info → PROC   │
                           │                   │          │  │ choose → RESULT       │
                           │                   │          │  │ cancel → CANCELLED    │
                           │                   │          │  │                       │
                           │                   │          │  └───────────────────────┘
                           │                   │          │
                           │                   │          │
                           │                   │    ┌─────┴─────┐
                           │                   │    │ ALL       │
                           │                   │    │ STRATEGIES│
                           │                   │    │ EXHAUSTED │
                           │                   │    └─────┬─────┘
                           │                   │          │
                           │                   │          ▼
                           │                   │    WAITING_HUMAN
                           │                   │
                           └─────────────────────────────────────────────────┘
```

---

# 5. Summary of Changes

## States: Add / Delete / Merge

| Action | State | Reason |
|--------|-------|--------|
| **ADD** | `DRAFT` | Auto-saved when WAITING_HUMAN times out |
| **ADD** | `VERIFIED` | Explicit verified state (optional, can merge with RESULT) |
| **KEEP** | All 12 states from v1 | Core flow unchanged |
| **NO DELETE** | — | All states still needed |

## Transitions: Changes

| Transition | v1 | v2 | Reason |
|------------|----|----|--------|
| `VERIFYING → RESULT` | Auto | Only if VERIFIED | Validation Gate |
| `VERIFYING → RECOVERING` | — | Added | Invalid result |
| `VERIFYING → WAITING_HUMAN` | — | Added | Uncertain result |
| `WAITING_HUMAN → COMMAND` | Required | Optional | Human can approve directly |
| `WAITING_HUMAN → PROCESSING` | — | Added | Human provides more info |
| `WAITING_HUMAN → CANCELLED` | — | Added | Human rejects |
| `RECOVERING → strategies` | Fixed | Dynamic | Failure-specific chains |

## Terminal States

| Terminal State | Description | How to Reach |
|---------------|-------------|--------------|
| `RESULT` | Success | PROCESSING success, VERIFYING verified |
| `CANCELLED` | User cancelled | Any active state → user cancel |
| `DRAFT` | Auto-saved timeout | WAITING_HUMAN → 30min timeout |

## Missing Failure Types (Now Added)

| # | Failure Type | Was Missing | Now Covered |
|---|--------------|-------------|-------------|
| FT01 | API Timeout | ✅ | ✅ |
| FT02 | Rate Limited | ✅ | ✅ |
| FT03 | Quota Exceeded | ❌ | ✅ |
| FT04 | Invalid JSON | ❌ | ✅ |
| FT05 | Schema Validation Fail | ❌ | ✅ |
| FT06 | AI Conflict | ✅ | ✅ |
| FT07 | AI Unavailable | ✅ | ✅ |
| FT08 | Financial Uncertainty | ❌ | ✅ |
| FT09 | Network Error | ✅ | ✅ |
| FT10 | Unknown Error | ❌ | ✅ |

## Is This Sufficient for MVP?

**Yes, with these conditions:**

| MVP Scope | States Needed | Implemented |
|-----------|---------------|-------------|
| Command → Process → Result | CREATED, COMMAND, PROCESSING, RESULT | ✅ |
| Basic Error Handling | RECOVERING, WAITING_HUMAN | ✅ |
| User Cancel | CANCELLED | ✅ |
| Basic Verification | VERIFYING | ✅ |
| Simple Recovery | Fallback to rule-based | ✅ |

**Not needed for MVP:**

| Feature | States | Priority |
|---------|--------|----------|
| Partial Success | PARTIAL_SUCCESS | Later |
| Retry Logic | RETRYING | Later |
| Fallback Chain | FALLBACK | Later |
| Draft Auto-save | DRAFT | Later |
| Advanced Verification | Detailed checks | Later |

## What to Prepare for Future

| Item | Purpose | Priority |
|------|---------|----------|
| FailureType Registry | Extensible failure handling | Prepare now |
| Strategy Chain Pattern | Generic recovery | Prepare now |
| Audit Trail Schema | Debugging | Prepare now |
| Verification Framework | Quality assurance | Prepare now |

---

## Final Recommendation

> **State Machine v2 is ready for Approval**
>
> Key improvements:
> 1. VERIFYING is now a true Validation Gate
> 2. WAITING_HUMAN has flexible human actions
> 3. Recovery Strategy is failure-specific and extensible
>
> **Ready to write Specification when approved** 🥢

---

**⚠️ ยังไม่ได้แก้ไข Specification — รอ Review และ Approval**
