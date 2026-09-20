# Hybrid AI / Cooperative AI — Pre-Mortem & Risk Analysis

> **สถานะ:** สำหรับ Review และ Approval เท่านั้น ยังไม่แก้ไข Specification ใด ๆ
>
> **วันที่:** 4 กันยายน 2026
>
> **บทบาท:** Architect + Risk Analyst
>
> **วัตถุประสงค์:** วิเคราะห์ล่วงหน้าก่อนลงมือออกแบบ Hybrid AI System สำหรับ Secretary App

---

## สารบัญ

- [A. Problem Inventory](#a-problem-inventory)
- [B. Recovery Matrix](#b-recovery-matrix)
- [C. Risk Classification](#c-risk-classification)
- [D. Architecture Impact](#d-architecture-impact)
- [E. Recommended Priority](#e-recommended-priority)
- [F. MVP / Prepare / Later](#f-mvp--prepare--later)

---

# A. Problem Inventory

## หมวดที่ 1: User / UX

### P01 — ผู้ใช้ไม่เข้าใจว่า AI กำลังทำอะไร

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ผู้ใช้ไม่เห็นว่า AI กำลังประมวลผลอะไร กำลังใช้ AI ตัวไหน หรือทำไมถึงใช้ AI |
| **Cause** | ไม่มี UI feedback ระหว่างรอผลจาก AI; ไม่มี explanation layer |
| **How to Detect** | User feedback, session recording, support tickets เรื่อง "ไม่รู้ว่าระบบทำอะไร" |
| **Impact** | ผู้ใช้ไม่ไว้วางใจระบบ, ไม่ใช้ฟีเจอร์ AI, หรือแก้ไขผลลัพธ์ที่ถูกต้องแล้ว |
| **Severity** | 🟡 Medium — ไม่ crash แต่สูญเสีย trust |
| **Possible Solutions** | (1) Loading indicator + status message, (2) AI reasoning preview, (3) "ทำไมถึงคิดแบบนี้?" button |
| **Recommended Solution** | (1) — เรียบง่าย, ให้ feedback ทันที |
| **Solution Priority** | High — ต้องทำตั้งแต่ต้น |
| **Recovery Steps** | N/A (เป็น UX issue ไม่ใช่ error) |
| **How to Verify** | Usability testing, A/B test กับ/ไม่มี status message |
| **Fallback** | แสดง "กำลังวิเคราะห์..." ตลอดเวลาที่รอ |
| **When to Escalate** | ถ้า user รีPort ว่าไม่เข้าใจมากกว่า 20% |

---

### P02 — ผู้ใช้ไม่รู้ว่า AI ให้ผลผิด

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI ตีความคำสั้นผิด (เช่น "กาแฟ 65" เป็น "เงินเดือน 65") แต่ผู้ใช้ไม่สังเกต |
| **Cause** | ไม่มี confirmation step หรือ preview ชัดเจนก่อนบันทึกจริง |
| **How to Detect** | Post-save edit rate, undo rate, user feedback |
| **Impact** | ข้อมูลการเงินผิด → รายงานผิด → ตัดสินใจผิด |
| **Severity** | 🔴 High — ข้อมูลการเงินต้องแม่น |
| **Possible Solutions** | (1) Preview card ก่อนบันทึก, (2) AI confidence score + visual indicator, (3) Highlight ส่วนที่ AI "เดา" |
| **Recommended Solution** | (1) + (3) — preview card ที่ highlight ส่วนที่ AI เติมเอง |
| **Solution Priority** | Critical — ต้องทำใน MVP |
| **Recovery Steps** | ผู้ใช้แก้ไขรายการ → ระบบบันทึกเป็น "user corrected" |
| **How to Verify** | ทดสอบประโยค 50+ แบบ, วัด accuracy |
| **Fallback** | ถ้า confidence ต่ำ → ถามผู้ใช้ก่อนบันทึก |
| **When to Escalate** | Accuracy ต่ำกว่า 90% |

---

## หมวดที่ 2: Network

### P03 — Network ไม่เสถียร / ขาดเน็ต

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | คำขอ AI ไปไม่ถึง provider หรือ timeout กลางทาง |
| **Cause** | มือถือผู้ใช้สัญญาณไม่ดี, VPN, firewall, provider outage |
| **How to Detect** | Network error, timeout, connection refused |
| **Impact** | Quick Capture ใช้งานไม่ได้ → ผู้ใช้หงุดหงิด, ไม่บันทึก |
| **Severity** | 🔴 High — Core feature ต้องใช้งานได้ |
| **Possible Solutions** | (1) Rule-based parser fallback (offline), (2) Cache ผลลัพธ์, (3) Retry with exponential backoff, (4) Queue แล้ว sync ทีหลัง |
| **Recommended Solution** | (1) — Rule-based parser ทำงาน offline ได้เสมอ |
| **Solution Priority** | Critical — MVP must |
| **Recovery Steps** | rule-based parser เข้ามาแทน → บันทึกใน local → sync ทีหลัง |
| **How to Verify** | ปิดเน็ตแล้วใช้ Quick Capture ต้องได้ผลลัพธ์ |
| **Fallback** | Rule-based parser (ปัจจุบัน) → manual input |
| **When to Escalate** | ถ้า rule-based parser ให้ผลผิดมากกว่า 30% |

---

### P04 — Latency สูง (AI ช้า)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI ใช้เวลา 3-10 วินาที ต่อคำขอ → ผู้ใช้รอไม่ไหว |
| **Cause** | LLM inference time, network round-trip, prompt ยาว |
| **How to Detect** | Request duration tracking, user abandonment rate |
| **Impact** | ผู้ใช้ไม่ใช้ AI, กลับไปใช้ rule-based หรือ manual |
| **Severity** | 🟡 Medium — ไม่ crash แต่สูญเสีย value |
| **Possible Solutions** | (1) Streaming response, (2) Speculative parsing (rule-based แล้ว AI ปรับ), (3) Cache common patterns, (4) Smaller/faster model |
| **Recommended Solution** | (2) — rule-based ให้ผลทันที, AI ปรับทีหลัง |
| **Solution Priority** | High |
| **Recovery Steps** | N/A (performance issue) |
| **How to Verify** | วัด P50/P95 latency, user satisfaction |
| **Fallback** | ใช้ rule-based parser เป็น primary, AI เป็น enhancer |
| **When to Escalate** | P95 > 5 วินาที |

---

## หมวดที่ 3: Authentication / Authorization

### P05 — AI Provider ไม่รู้จัก User Identity

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI provider ไม่รู้ว่า user ไหนส่งคำขอ → ไม่สามารถ rate limit หรือ audit ได้ |
| **Cause** | API key ใช้ร่วมกันทุก user, ไม่มี user-scoped token |
| **How to Detect** | ตรวจสอบว่าทุก request มี user_id ใน metadata |
| **Impact** | ไม่สามารถ track usage ต่อ user, ไม่สามารถ rate limit ได้ |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Server-side proxy ที่ inject user_id, (2) Per-user API key (complex), (3) Usage tracking ใน database |
| **Recommended Solution** | (1) — Server-side proxy ที่ validated user ก่อนส่งต่อ |
| **Solution Priority** | High |
| **Recovery Steps** | N/A |
| **How to Verify** | ตรวจสอบ log ว่าทุก request มี user_id |
| **Fallback** | N/A |
| **When to Escalate** | ถ้าพบ request ที่ไม่มี user_id |

---

### P06 — User หมดสิทธิ์ใช้ AI (quota)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | Free tier หมด → ระบบไม่สามารถให้บริการ AI ได้ |
| **Cause** | Free tier มี limit, user ใช้เกิน quota |
| **How to Detect** | Provider error 429, quota exceeded |
| **Impact** | Quick Capture ไม่สามารถใช้ AI ได้ → ต้อง fallback |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Graceful fallback to rule-based, (2) Show quota status, (3) Allow user to add own API key |
| **Recommended Solution** | (1) + (2) — fallback + transparent quota display |
| **Solution Priority** | High |
| **Recovery Steps** | rule-based parser เข้ามาแทน |
| **How to Verify** | ทดสอบเมื่อ quota หมด → ต้อง fallback ได้ |
| **Fallback** | Rule-based parser |
| **When to Escalate** | N/A |

---

## หมวดที่ 4: AI Provider

### P07 — AI Provider ให้ผลลัพธ์ขัดแย้งกัน

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | Dev8Studio AI ตีความ "โอนออม 5000" ว่า transfer to savings, แต่ AI Free Tier ตีความว่า expense |
| **Cause** | สอง model มี training data ต่างกัน, ไม่มี ground truth |
| **How to Detect** | Cross-validation: เปรียบเทียบผลลัพธ์จากทั้งสอง AI |
| **Impact** | ผู้ใช้สับสน, ข้อมูลไม่ consistent |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Majority voting (2 AI → ต้อง同意), (2) Confidence-weighted selection, (3) User confirmation เมื่อขัดแย้ง, (4) Rule-based as tiebreaker |
| **Recommended Solution** | (3) — ถามผู้ใช้เมื่อขัดแย้ง (user is source of truth) |
| **Solution Priority** | High |
| **Recovery Steps** | ถามผู้ใช้เลือกผลลัพธ์ที่ถูกต้อง |
| **How to Verify** | ทดสอบประโยคที่ AI มักตีความต่างกัน |
| **Fallback** | ใช้ rule-based parser เป็น tiebreaker |
| **When to Escalate** | ถ้าขัดแย้งมากกว่า 20% ของคำขอ |

---

### P08 — AI ตีความผิด (Misclassification)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI จัดประเภทผิด: รายรับเป็นรายจ่าย, โอนเป็นรายจ่าย, หมวดหมู่ผิด |
| **Cause** | บริบทไม่พอ, คำสั้นเกินไป, model ไม่เข้าใจภาษาไทย |
| **How to Detect** | User edit rate, post-save correction, accuracy metrics |
| **Impact** | รายงานการเงินผิด |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Few-shot examples ใน prompt, (2) Category mapping table, (3) User correction feedback loop, (4) Predefined templates |
| **Recommended Solution** | (1) + (3) — few-shot + feedback loop |
| **Solution Priority** | Critical |
| **Recovery Steps** | ผู้ใช้แก้ไข → บันทึกเป็น training data |
| **How to Verify** | วัด accuracy กับ test set 50+ ประโยค |
| **Fallback** | Rule-based parser + manual input |
| **When to Escalate** | Accuracy < 85% |

---

### P09 — AI ให้ผลลัพธ์ที่ไม่ valid (JSON/Schema)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI คืน JSON ที่ไม่ตรง schema (missing fields, wrong types, extra fields) |
| **Cause** | LLM ไม่รู้จัก schema อย่างแม่นยำ, prompt ไม่ชัด |
| **How to Detect** | Schema validation failure, parsing error |
| **Impact** | ระบบต้อง retry หรือ fallback |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Structured output mode (function calling), (2) Schema in prompt + few-shot, (3) JSON repair, (4) Retry with stricter prompt |
| **Recommended Solution** | (1) — function calling / structured output |
| **Solution Priority** | High |
| **Recovery Steps** | Retry 1 ครั้ง → fallback to rule-based |
| **How to Verify** | วัด JSON validation pass rate |
| **Fallback** | Rule-based parser |
| **When to Escalate** | Validation failure > 10% |

---

## หมวดที่ 5: Free Tier / Quota / Rate Limit

### P10 — Free Tier หมดระหว่างวัน

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ผู้ใช้ใช้ AI หมด free tier ตอนเที่ยง → บ่ายไม่ได้ใช้ |
| **Cause** | ไม่มี daily limit หรือ smart quota management |
| **How to Detect** | Provider error, usage dashboard |
| **Impact** | ผู้ใช้ไม่สามารถใช้ Quick Capture ด้วย AI ได้ |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Daily quota allocation, (2) Smart queuing (重要因素 ใช้ AI, เรื่องง่าย ใช้ rule), (3) Usage warning, (4) Cache ผลลัพธ์ |
| **Recommended Solution** | (2) — smart routing: ง่าย → rule-based, ยาก → AI |
| **Solution Priority** | High |
| **Recovery Steps** | แสดง warning → fallback to rule-based |
| **How to Verify** | ทดสอบเมื่อ quota หมด |
| **Fallback** | Rule-based parser |
| **When to Escalate** | N/A |

---

### P11 — Rate Limit จาก Provider

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ส่งคำขอเร็วเกินไป → 429 error |
| **Cause** | ไม่มี rate limiter ในระบบ, ผู้ใช้กดเร็ว |
| **How to Detect** | HTTP 429, provider error |
| **Impact** | คำขอถูก reject |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Client-side debounce, (2) Server-side rate limiter, (3) Token bucket algorithm, (4) Queue |
| **Recommended Solution** | (1) + (2) — debounce + server rate limiter |
| **Solution Priority** | Medium |
| **Recovery Steps** | แสดง "กรุณารอสักครู่" → retry after delay |
| **How to Verify** | ทดสอบกดเร็วๆ ต้องไม่ error |
| **Fallback** | แสดง error message + retry button |
| **When to Escalate** | N/A |

---

## หมวดที่ 6: Timeout / Model Availability

### P12 — AI Provider มี downtime

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI provider ปิดซ่อมบำรุงหรือล่ม |
| **Cause** | Provider-side issue |
| **How to Detect** | Health check, error rate spike |
| **Impact** | ระบบ AI ใช้ไม่ได้ชั่วคราว |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Multi-provider failover, (2) Health check + circuit breaker, (3) Rule-based fallback |
| **Recommended Solution** | (3) — rule-based เป็น fallback เสมอ |
| **Solution Priority** | High |
| **Recovery Steps** | Circuit breaker เปิด → rule-based เข้ามา → provider กลับมา → circuit breaker ปิด |
| **How to Verify** | ปิด AI provider ชั่วคราว → ระบบยังใช้ได้ |
| **Fallback** | Rule-based parser |
| **When to Escalate** | Provider down > 1 ชั่วโมง |

---

### P13 — Model ถูก retire / version หมดอายุ

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | Provider ยกเลิก model version ที่ใช้ |
| **Cause** | Provider update cycle |
| **How to Detect** | API error, deprecation notice |
| **Impact** | ต้องเปลี่ยน model → ต้อง test ใหม่ |
| **Severity** | 🟢 Low — ไม่ urgent |
| **Possible Solutions** | (1) Model version pinning, (2) Abstraction layer, (3) Compatibility testing |
| **Recommended Solution** | (2) — abstraction layer ทำให้เปลี่ยน model ง่าย |
| **Solution Priority** | Medium |
| **Recovery Steps** | เปลี่ยน model version → test → deploy |
| **How to Verify** | ทดสอบกับ new model |
| **Fallback** | Rule-based parser |
| **When to Escalate** | ถ้า model ที่เปลี่ยน accuracy ลดลงมาก |

---

## หมวดที่ 7: Context / Token

### P14 — Context ยาวเกินไป (Token limit)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ถ้าส่งข้อมูลประวัติการเงินทั้งหมด → token limit เต็ม |
| **Cause** | LLM มี max context window |
| **How to Detect** | Token count error, truncation warning |
| **Impact** | ข้อมูลถูกตัด → AI ตีความผิด |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) เฉพาะข้อมูลที่จำเป็นเท่านั้น, (2) Summary + recent transactions, (3) Token counting + chunking |
| **Recommended Solution** | (1) — ส่งเฉพาะ context ที่จำเป็น |
| **Solution Priority** | High |
| **Recovery Steps** | ลด context → retry |
| **How to Verify** | นับ tokens ก่อนส่ง |
| **Fallback** | ลด context เหลือ 5 รายการล่าสุด |
| **When to Escalate** | N/A |

---

## หมวดที่ 8: Prompt / Structured Output

### P15 — Prompt injection / manipulation

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ผู้ใช้พิมพ์ข้อความที่ทำให้ AI "ลืม" หน้าที่ แล้วทำสิ่งอื่น |
| **Cause** | LLM ไม่มี boundary ชัดเจน |
| **How to Detect** | Output ไม่ตรง expected format, ข้อความแปลกๆ |
| **Impact** | ผลลัพธ์ผิด, potential security issue |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) System prompt ชัดเจน, (2) Output validation, (3) Input sanitization, (4) Response guardrails |
| **Recommended Solution** | (1) + (2) — system prompt + validation |
| **Solution Priority** | Medium |
| **Recovery Steps** | Validate → reject → retry with stricter prompt |
| **How to Verify** | ทดสอบ adversarial inputs |
| **Fallback** | Rule-based parser |
| **When to Escalate** | N/A |

---

### P16 — AI ทำงานเกิน Scope (Action scope creep)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI แก้ไขข้อมูลที่ไม่ได้ขอ, ลบรายการ, หรือทำสิ่งที่ไม่ได้รับอนุญาต |
| **Cause** | ไม่มี action boundary, prompt ไม่ชัด |
| **How to Detect** | Audit log, unexpected changes |
| **Impact** | ข้อมูลหาย/เสียหาย |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Read-only AI (วิเคราะห์เท่านั้น), (2) Explicit action whitelist, (3) Confirmation required, (4) Audit trail |
| **Recommended Solution** | (1) + (3) — read-only AI + confirmation |
| **Solution Priority** | Critical |
| **Recovery_steps** | Restore from backup/audit log |
| **How to Verify** | ทดสอบว่า AI ไม่สามารถแก้ไขข้อมูลได้ |
| **Fallback** | N/A — ป้องกันไม่ให้เกิด |
| **When to Escalate** | ทุกครั้งที่พบ |

---

## หมวดที่ 9: Orchestrator

### P17 — Orchestrator เลือก AI ผิด

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | Orchestrator ส่งงานให้ AI ตัวที่ไม่เหมาะ (เช่น งานภาษาไทย ไปให้ model ที่ไม่รองรับ) |
| **Cause** | ไม่มี capability matching, ไม่มี language detection |
| **How to Detect** | Quality metrics, user correction rate |
| **Impact** | ผลลัพธ์แย่กว่าที่ควร |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Capability matrix, (2) Language detection, (3) Simple routing rules, (4) Fallback chain |
| **Recommended Solution** | (3) — simple routing rules |
| **Solution Priority** | Medium |
| **Recovery Steps** | Retry กับ AI ตัวอื่น |
| **How to Verify** | วัด accuracy ต่อ AI provider |
| **Fallback** | ใช้ rule-based parser |
| **When to Escalate** | accuracy < 80% สำหรับ AI ตัวหนึ่ง |

---

### P18 — Orchestrator สร้าง infinite loop

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | Orchestrator ส่งงานไปมา ไม่จบ (AI A → AI B → AI A → ...) |
| **Cause** | ไม่มี circuit breaker, ไม่มี max retry |
| **How to Detect** | Request count per job, timeout |
| **Impact** | System hang, resource waste |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Max retry limit, (2) Circuit breaker, (3) Request tracing (correlation ID), (4) Timeout per stage |
| **Recommended Solution** | (1) + (4) — max retry + timeout |
| **Solution Priority** | High |
| **Recovery Steps** | Break circuit → fallback to rule-based |
| **How to Verify** | ทดสอบ loop scenario |
| **Fallback** | Rule-based parser |
| **When to Escalate** | N/A |

---

## หมวดที่ 10: Retry / Backoff / Fallback

### P19 — Retry storm

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | Retry ทุก request พร้อมกัน → provider ล่มหนักกว่าเดิม |
| **Cause** | ไม่มี jitter, ไม่มี backoff |
| **How to Detect** | Request spike, provider error rate |
| **Impact** | Provider ban, system degradation |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Exponential backoff + jitter, (2) Rate limiter per user, (3) Queue + backpressure |
| **Recommended Solution** | (1) — exponential backoff + jitter |
| **Solution Priority** | High |
| **Recovery Steps** | Backoff → wait → retry |
| **How to Verify** | ทดสอบ burst scenario |
| **Fallback** | Rule-based parser |
| **When to Escalate** | N/A |

---

## หมวดที่ 11: Database / Data Consistency

### P20 — AI บันทึกข้อมูลซ้ำ (Duplicate)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI ส่งผลลัพธ์เดียวกัน 2 ครั้ง → เกิดรายการซ้ำ |
| **Cause** | Network retry, UI double-click, idempotency key หาย |
| **How to Detect** | Duplicate detection query, user report |
| **Impact** | ข้อมูลซ้ำ → รายงานผิด |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Idempotency key per request, (2) Deduplication logic, (3) Unique constraint, (4) UI disable double-click |
| **Recommended Solution** | (1) + (4) — idempotency key + UI protection |
| **Solution Priority** | Critical |
| **Recovery Steps** | Deduplicate → keep latest |
| **How to Verify** | ทดสอบ double-submit |
| **Fallback** | Manual deduplication |
| **When to Escalate** | ถ้าพบซ้ำมากกว่า 5% |

---

### P21 — Local-Cloud sync conflict

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ข้อมูล local และ cloud ขัดแย้งกัน (offline edit + online edit) |
| **Cause** | Offline-first + multi-device sync |
| **How to Detect** | Sync conflict flag, data discrepancy |
| **Impact** | ข้อมูลสูญหายหรือผิด |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Last-write-wins, (2) CRDT, (3) Field-level merge, (4) Conflict resolution UI |
| **Recommended Solution** | (4) — conflict resolution UI (simplest, user is judge) |
| **Solution Priority** | Medium |
| **Recovery Steps** | แสดง conflict → ผู้ใช้เลือก |
| **How to Verify** | ทดสอบ multi-device offline editing |
| **Fallback** | Last-write-wins |
| **When to Escalate** | N/A |

---

## หมวดที่ 12: Security / Privacy

### P22 — ข้อมูลการเงินรั่วผ่าน AI provider

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ข้อมูลการเงินของผู้ใช้ถูกส่งไปให้ AI provider → provider อาจเก็บหรือใช้ต่อ |
| **Cause** | AI provider อาจมี data retention policy |
| **How to Detect** | Provider privacy policy, audit |
| **Impact** | Privacy breach, regulatory violation |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Anonymize ข้อมูลก่อนส่ง, (2) Use provider ที่ไม่เก็บ data, (3) On-premise AI, (4) User consent + disclosure |
| **Recommended Solution** | (2) + (4) — เลือก provider ที่ไม่เก็บ data + เปิดเผยต่อผู้ใช้ |
| **Solution Priority** | Critical |
| **Recovery Steps** | N/A — ป้องกันไม่ให้เกิด |
| **How to Verify** | Audit provider privacy policy |
| **Fallback** | ไม่ส่งข้อมูลการเงินจริง ใช้ anonymized data |
| **When to Escalate** | ทุกครั้งที่พบ |

---

### P23 — API key หลุด

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI API key ถูกเปิดเผยใน client-side code |
| **Cause** | Key hard-coded ใน frontend, ไม่มี server-side proxy |
| **How to Detect** | Security audit, key leak scanner |
| **Impact** | ค่าใช้จ่ายไม่จำกัด, ถูก abuse |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Server-side only, (2) Environment variable, (3) Key rotation, (4) Usage limit |
| **Recommended Solution** | (1) — server-side proxy เท่านั้น |
| **Solution Priority** | Critical |
| **Recovery Steps** | Rotate key → ตรวจสอบ usage |
| **How to Verify** | ตรวจสอบว่า key ไม่ปรากฏใน client bundle |
| **Fallback** | N/A |
| **When to Escalate** | ทุกครั้งที่พบ |

---

## หมวดที่ 13: Cost

### P24 — ค่าใช้จ่าย AI บานปลาย

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ผู้ใช้หลายคน × หลายคำขอ = ค่าใช้จ่ายสูง |
| **Cause** | ไม่มี cost control, ไม่มี smart routing |
| **How to Detect** | Billing dashboard, cost alert |
| **Impact** | ค่าใช้จ่ายเกิน budget |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Per-user daily limit, (2) Smart routing (ง่าย → rule-based), (3) Cost alert, (4) User pays for own key |
| **Recommended Solution** | (2) — smart routing ลดการใช้ AI |
| **Solution Priority** | High |
| **Recovery Steps** | ลด quota → แจ้งเตือน |
| **How to Verify** | วัด cost ต่อ user |
| **Fallback** | Rule-based parser |
| **When to Escalate** | Cost > budget |

---

### P25 — Cost ต่อ user ไม่ transparent

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ผู้ใช้ไม่รู้ว่า AI ต้องเสียเงิน → ไม่เข้าใจทำไมถึงมี limit |
| **Cause** | ไม่มี usage dashboard |
| **How to Detect** | User feedback |
| **Impact** | ไม่เข้าใจ system, ไม่ไว้วางใจ |
| **Severity** | 🟢 Low |
| **Possible Solutions** | (1) Usage dashboard, (2) Quota display, (3) Cost explanation |
| **Recommended Solution** | (2) — แสดง quota ที่เหลือ |
| **Solution Priority** | Medium |
| **Recovery Steps** | N/A |
| **How to Verify** | User testing |
| **Fallback** | N/A |
| **When to Escalate** | N/A |

---

## หมวดที่ 14: Logging / Monitoring

### P26 — ไม่มี audit trail สำหรับ AI decisions

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ไม่สามารถตรวจสอบได้ว่า AI ตีความอย่างไร ทำไมถึงได้ผลลัพธ์นั้น |
| **Cause** | ไม่มี logging layer |
| **Impact** | แก้ปัญหาไม่ได้, ไม่สามารถ improve ได้ |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Structured logging (input → AI output → final), (2) Prompt/response storage, (3) Analytics dashboard |
| **Recommended Solution** | (1) — structured logging |
| **Solution Priority** | High |
| **Recovery Steps** | N/A |
| **How to Verify** | ตรวจสอบ log ว่ามีข้อมูลครบ |
| **Fallback** | N/A |
| **When to Escalate** | N/A |

---

### P27 — Silent failure (ไม่มี error แต่ผลผิด)

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI ให้ผลลัพธ์ที่ "ดูเหมือนถูก" แต่จริงๆ ผิด (เช่น หมวดหมู่ผิด, จำนวนเงินผิดเล็กน้อย) |
| **Cause** | ไม่มี validation logic, ไม่มี human review |
| **Impact** | ข้อมูลการเงินผิดสะสม → รายงานผิด |
| **Severity** | 🔴 High — **เงียบแต่อันตรายมาก** |
| **Possible Solutions** | (1) Cross-validation กับ rule-based, (2) Statistical anomaly detection, (3) Periodic human review, (4) User feedback loop |
| **Recommended Solution** | (1) + (4) — cross-validation + feedback |
| **Solution Priority** | Critical |
| **Recovery_steps** | ตรวจพบ anomaly → flag → ให้ user ตรวจสอบ |
| **How to Verify** | วัด accuracy กับ known-correct data |
| **Fallback** | Flag รายการที่น่าสงสัย |
| **When to Escalate** | Accuracy < 90% |

---

## หมวดที่ 15: Recovery Failure

### P28 — Fallback ไม่ทำงาน

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ทั้ง AI และ rule-based parser ไม่ทำงาน |
| **Cause** | Bug ใน rule-based, data format ผิด |
| **How to Detect** | Error rate spike, user report |
| **Impact** | Quick Capture ใช้ไม่ได้เลย |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Manual input mode, (2) Multiple fallback levels, (3) Health check |
| **Recommended Solution** | (1) + (2) — manual input + multi-level fallback |
| **Solution Priority** | Critical |
| **Recovery Steps** | Manual input → บันทึกใน local |
| **How to Verify** | ปิดทั้ง AI และ rule-based → ยังใช้ได้ |
| **Fallback** | Manual form input |
| **When to Escalate** | N/A |

---

### P29 — Recovery data หาย

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ข้อมูลที่บันทึกไว้หายระหว่าง recovery |
| **Cause** | Backup ไม่ complete, sync conflict |
| **How to Detect** | Data loss report |
| **Impact** | ข้อมูลการเงินสูญหาย |
| **Severity** | 🔴 High |
| **Possible Solutions** | (1) Local-first persistence, (2) Regular backup, (3) Transaction log |
| **Recommended Solution** | (1) — local-first (ปัจจุบันทำอยู่แล้ว) |
| **Solution Priority** | High |
| **Recovery_steps** | Restore from local backup |
| **How to Verify** | ทดสอบ data persistence |
| **Fallback** | Export/restore from JSON |
| **When to Escalate** | ทุกครั้งที่พบ |

---

## หมวดที่ 16: Financial Safety (สำคัญมาก)

### P30 — AI แก้ไข Balance โดยตรง

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI คำนวณผิดแล้วแก้ไข balance ใน database โดยตรง |
| **Cause** | ไม่มี boundary ชัดเจนระหว่าง AI และ Secretary Core |
| **How to Detect** | Audit log, balance discrepancy |
| **Impact** | ข้อมูลการเงินผิด → ผู้ใช้สูญเสียเงิน (ในข้อมูล) |
| **Severity** | 🔴🔴 Critical — **ห้ามเกิดเด็ดขาด** |
| **Possible Solutions** | (1) AI เป็น read-only, (2) Balance แก้ไขได้เฉพาะ transaction, (3) Double-entry, (4) Reconciliation check |
| **Recommended Solution** | (1) + (2) — AI read-only + balance = sum of transactions |
| **Solution Priority** | Critical — MVP must |
| **Recovery_steps** | Rebuild balance จาก transactions |
| **How to Verify** | ทดสอบว่า AI ไม่สามารถแก้ balance ได้ |
| **Fallback** | N/A — ป้องกันไม่ให้เกิด |
| **When to Escalate** | ทุกครั้งที่พบ |

---

### P31 — AI สร้าง transaction ปลอม

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI สร้าง transaction ที่ผู้ใช้ไม่ได้ทำจริง |
| **Cause** | AI ตีความผิด, prompt injection |
| **How to Detect** | User report, anomaly detection |
| **Impact** | ข้อมูลเท็จ |
| **Severity** | 🔴🔴 Critical |
| **Possible Solutions** | (1) User confirmation required, (2) AI สร้าง draft → user approve, (3) Audit trail |
| **Recommended Solution** | (2) — draft → approve model |
| **Solution Priority** | Critical |
| **Recovery_steps** | Delete fake transaction |
| **How to Verify** | ทดสอบ adversarial inputs |
| **Fallback** | N/A |
| **When to Escalate** | ทุกครั้งที่พบ |

---

### P32 — AI คำนวณ Opening Balance ผิด

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI คำนวณยอดเปิดบัญชีผิด → balance ทั้งระบบผิด |
| **Cause** | AI ไม่ควรแตะ opening balance |
| **How to Detect** | Balance reconciliation |
| **Impact** | ข้อมูลการเงินทั้งระบบผิด |
| **Severity** | 🔴🔴 Critical |
| **Possible Solutions** | (1) Opening balance เป็น sacred field — ห้าม AI แตะ, (2) Manual entry only |
| **Recommended Solution** | (1) — sacred field |
| **Solution Priority** | Critical |
| **Recovery_steps** | Manual correction |
| **How to Verify** | ทดสอบว่า AI ไม่สามารถแก้ opening balance ได้ |
| **Fallback** | N/A |
| **When to Escalate** | ทุกครั้งที่พบ |

---

### P33 — Reconciliation ผิด

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | AI กระทบยอด (reconcile) ผิด → balance ตรงกับ bank จริง |
| **Cause** | AI ไม่ควรมีอำนาจ reconcile |
| **How to Detect** | Bank statement comparison |
| **Impact** | ข้อมูลไม่ตรง bank |
| **Severity** | 🔴🔴 Critical |
| **Possible Solutions** | (1) Reconciliation เป็น manual process เท่านั้น, (2) AI ช่วย suggest เท่านั้น |
| **Recommended Solution** | (1) — manual only |
| **Solution Priority** | Critical |
| **Recovery_steps** | Manual reconcile |
| **How to Verify** | ทดสอบว่า AI ไม่สามารถ reconcile ได้ |
| **Fallback** | N/A |
| **When to Escalate** | ทุกครั้งที่พบ |

---

## หมวดที่ 17: Human Escalation

### P34 — ระบบควรหยุดและส่งให้มนุษย์

| รายการ | รายละเอียด |
|--------|------------|
| **Problem** | ระบบพยายามแก้ปัญหาเองต่อ ทั้งที่ควรหยุด |
| **Cause** | ไม่มี escalation policy |
| **How to Detect** | Audit log, user complaint |
| **Impact** | ปัญหาบานปลาย |
| **Severity** | 🟡 Medium |
| **Possible Solutions** | (1) Escalation policy, (2) Confidence threshold, (3) Human-in-the-loop |
| **Recommended Solution** | (1) + (2) |
| **Solution Priority** | High |
| **Recovery_steps** | แสดง "กรุณาติดต่อทีมงาน" |
| **How to Verify** | ทดสอบ escalation scenario |
| **Fallback** | N/A |
| **When to Escalate** | ดูตารางด้านล่าง |

**เมื่อไหร่ต้อง Escalate ให้มนุษย์:**

| Scenario | Action |
|----------|--------|
| AI ให้ผลลัพธ์ขัดแย้งกัน > 2 ครั้ง | หยุด → ให้ user เลือก |
| Accuracy < 80% สำหรับ user คนหนึ่ง | หยุด → ให้ user ตรวจสอบ |
| Financial data ดู anomaly (ยอดสูงผิดปกติ) | หยุด → confirm กับ user |
| Provider ทั้งหมด down | หยุด AI → ใช้ rule-based |
| Cost > budget | หยุด → แจ้ง admin |
| Data loss detected | หยุด → backup + restore |
| Security breach suspected | หยุด → แจ้ง admin + user |

---

# B. Recovery Matrix

## Summary: Self-Recovery Flow

```
User พิมพ์คำสั้น
       │
       ▼
┌──────────────┐
│  AI Processing │
│  (Orchestrator)│
└──────┬───────┘
       │
   ┌───┴───┐
   │ Success│──→ Validate ──→ OK ──→ Show Preview ──→ User Confirm ──→ Save
   └───┬───┘                     │
       │                     Not OK
       │                        │
       ▼                        ▼
   ┌───────────┐         ┌──────────────┐
   │ AI Error/  │         │ Cross-Validate│
   │ Timeout    │         │ with Rule-based│
   └─────┬─────┘         └──────┬───────┘
         │                      │
         ▼                 ┌────┴────┐
   ┌───────────┐          │ Match   │ No Match
   │ Rule-based │          │         │
   │ Fallback   │          ▼         ▼
   └─────┬─────┘       Show Both   Ask User
         │             to User     to Choose
         ▼
   ┌───────────┐
   │ Show Preview│
   │ + Status    │
   └─────┬─────┘
         │
    ┌────┴────┐
    │ User OK │──→ Save
    └────┬────┘
         │ User Edit
         ▼
    ┌───────────┐
    │ Save Edited│
    │ + Feedback │
    └───────────┘
```

## Recovery per Problem Category

| Category | Detect | Try #1 | Verify | If Failed → #2 | Verify | Fallback | Escalate |
|----------|--------|--------|--------|-----------------|--------|----------|----------|
| AI Provider Down | Health check | Rule-based | Accuracy check | Manual input | User confirm | Manual form | Admin alert |
| AI Wrong Result | Validation | Cross-validate | Compare | User confirm | User choice | Manual input | User review |
| Network Error | Timeout | Retry (3x) | Success? | Rule-based | Accuracy | Manual input | User report |
| Rate Limit | 429 error | Backoff + retry | Success? | Queue | Wait | Rule-based | N/A |
| Token Limit | Token count | Reduce context | Success? | Simplified prompt | Success? | Rule-based | N/A |
| Duplicate | Dedup check | Skip save | Done? | Merge logic | Done? | User dedup | User report |
| Data Conflict | Conflict flag | Show both | User chose | Last-write-wins | Done? | Manual merge | User review |
| Cost Overrun | Cost alert | Reduce quota | Done? | Smart routing | Done? | Rule-only | Admin review |
| Security Breach | Audit | Block | Done? | Rotate key | Done? | Disable AI | Admin + user |

---

# C. Risk Classification

## Risk Matrix

| Risk Level | Count | Examples |
|-----------|-------|----------|
| 🔴🔴 Critical (ห้ามเกิด) | 4 | P30 (AI แก้ balance), P31 (transaction ปลอม), P32 (opening balance), P33 (reconciliation) |
| 🔴 High | 8 | P02 (ผลผิด), P03 (network), P08 (misclassification), P16 (scope creep), P20 (duplicate), P22 (privacy), P23 (key leak), P27 (silent failure), P28 (fallback fail), P29 (data loss) |
| 🟡 Medium | 13 | P01, P04, P05, P06, P07, P09, P10, P11, P12, P14, P15, P17, P18, P19, P21, P24, P26, P34 |
| 🟢 Low | 2 | P13, P25 |

## Financial Safety Boundary

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECRETARY CORE                                │
│                    (Source of Truth)                             │
│                                                                 │
│  ✅ Balance calculation (from transactions)                     │
│  ✅ Opening Balance (manual only)                               │
│  ✅ Transaction CRUD (user-initiated)                           │
│  ✅ Reconciliation (manual)                                     │
│  ✅ Daily closing                                               │
│  ✅ Financial history                                           │
│  ✅ Account management                                          │
│  ✅ Transfer between accounts                                   │
│                                                                 │
│  🔒 Sacred Fields:                                              │
│     • opening_balance                                           │
│     • balance (derived from transactions)                       │
│     • reconciliation_status                                     │
│     • financial_history                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Read-only access
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI LAYER                                     │
│                    (Assistant / Interpreter / Analyzer)          │
│                                                                 │
│  ✅ Parse user input → suggest transaction                      │
│  ✅ Categorize transactions                                     │
│  ✅ Summarize financial data                                    │
│  ✅ Analyze spending patterns                                   │
│  ✅ Suggest budget adjustments                                  │
│  ✅ Answer financial questions                                  │
│  ❌ Cannot modify balance directly                              │
│  ❌ Cannot create transactions without user approval             │
│  ❌ Cannot reconcile                                            │
│  ❌ Cannot modify opening balance                               │
│  ❌ Cannot delete transactions                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# D. Architecture Impact

## สิ่งที่ต้องเปลี่ยน

| Area | Current | Needed for Hybrid AI |
|------|---------|---------------------|
| **Quick Capture** | Rule-based parser only | AI Orchestrator + multi-provider |
| **Server** | Simple CRUD | AI proxy + routing + rate limiting |
| **Database** | transactions, accounts, goals | + ai_logs, ai_requests, ai_quotas |
| **Frontend** | Form + preview | + AI status indicator + confidence display |
| **Error handling** | Simple toast | Multi-level recovery + escalation |

## สิ่งที่ต้องเพิ่ม

### Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| **AI Orchestrator** | Route requests, manage fallbacks, track usage | Critical |
| **AI Provider Adapter** | Abstraction layer สำหรับหลาย provider | Critical |
| **AI Validator** | ตรวจสอบผลลัพธ์จาก AI ก่อนบันทึก | Critical |
| **AI Logger** | บันทึก input/output/latency/accuracy | High |
| **Rate Limiter** | จำกัดจำนวนคำขอต่อ user | High |
| **Circuit Breaker** | ป้องกัน retry storm | High |
| **Quota Manager** | จัดการ free tier allocation | High |
| **Cost Tracker** | ติดตามค่าใช้จ่าย | Medium |

### Interfaces / Adapters

| Interface | Purpose |
|-----------|---------|
| `AIProviderAdapter` | Standard interface สำหรับทุก AI provider |
| `AICacheAdapter` | Cache ผลลัพธ์สำหรับ pattern ที่ซ้ำ |
| `AIValidatorAdapter` | Cross-validate กับ rule-based |
| `AIQuotaAdapter` | Track และ enforce quota |

### Database Tables (เพิ่มเติม)

```sql
-- AI request logging
CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  input_text TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  model_version TEXT,
  output JSONB,
  latency_ms INTEGER,
  confidence DECIMAL(3,2),
  validated BOOLEAN DEFAULT FALSE,
  user_corrected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI quota tracking
CREATE TABLE ai_quotas (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  daily_used INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 50,
  monthly_used INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 1000,
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI provider health
CREATE TABLE ai_provider_health (
  provider TEXT PRIMARY KEY,
  status TEXT DEFAULT 'healthy',
  last_check TIMESTAMPTZ,
  error_rate DECIMAL(5,4),
  avg_latency_ms INTEGER
);
```

## สิ่งที่ไม่ควรทำใน MVP

| Item | Reason |
|------|--------|
| Multi-provider failover | Rule-based fallback พอสำหรับ MVP |
| Cost tracking dashboard | ติดตามใน log ก่อน |
| User quota management | ใช้ global limit ก่อน |
| AI feedback loop (learning) | เก็บ log ก่อน ทำ ML ทีหลัง |
| On-premise AI | ซับซ้อนเกินไป |

## สิ่งที่ควรเตรียม Architecture ไว้ตั้งแต่ต้น

| Item | Reason |
|------|--------|
| AI Provider Adapter interface | เปลี่ยน provider ง่าย |
| Structured logging | จำเป็นสำหรับ debugging |
| Circuit breaker pattern | ป้องกัน cascade failure |
| Read-only AI boundary | Financial safety |
| User confirmation flow | Trust + accuracy |

---

# E. Recommended Priority

## Phase 1: Foundation (MVP)

| Priority | Item | Status |
|----------|------|--------|
| P0 | Rule-based parser ทำงาน offline ได้เสมอ | ✅ มีอยู่แล้ว |
| P0 | Financial safety boundary (AI read-only) | ต้องออกแบบ |
| P0 | User confirmation flow (preview → approve) | ✅ มีอยู่แล้ว |
| P0 | AI Provider Adapter interface | ต้องสร้าง |
| P0 | AI Validator (cross-validate กับ rule-based) | ต้องสร้าง |
| P1 | Structured logging | ต้องสร้าง |
| P1 | Rate limiter | ต้องสร้าง |
| P1 | Circuit breaker | ต้องสร้าง |

## Phase 2: Intelligence

| Priority | Item |
|----------|------|
| P1 | AI Orchestrator (routing + fallback) |
| P1 | Multi-provider support |
| P2 | Confidence scoring |
| P2 | Quota management |
| P2 | AI status indicator UI |

## Phase 3: Optimization

| Priority | Item |
|----------|------|
| P2 | Cost tracking |
| P2 | AI feedback loop |
| P3 | A/B testing framework |
| P3 | Analytics dashboard |
| P3 | Learning from corrections |

---

# F. MVP / Prepare / Later

## ✅ ทำใน MVP

| Item | Reason |
|------|--------|
| Rule-based parser (ปัจจุบัน) ต้องทำงานได้ 100% | Fallback หลัก |
| AI Provider Adapter interface | ทำให้เปลี่ยน provider ง่าย |
| User confirmation flow | Trust + accuracy |
| Financial safety boundary | ป้องกัน data corruption |
| Structured logging | Debugging + improvement |
| AI status indicator | UX |
| Rate limiter | ป้องกัน abuse |
| Circuit breaker | ป้องกัน cascade failure |

## 🔧 เตรียม Architecture ไว้ตั้งแต่ต้น

| Item | Reason |
|------|--------|
| AI Orchestrator pattern | ขยายเป็น multi-provider ง่าย |
| Cross-validation pattern | ปรับเป็น ML validation ทีหลัง |
| Audit trail pattern | ขยายเป็น analytics ทีหลัง |
| Quota management interface | เพิ่ม quota logic ทีหลัง |

## ⏳ ทำภายหลัง

| Item | Reason |
|------|--------|
| Multi-provider failover | -rule-based พอ |
| Cost tracking dashboard | log ก่อน |
| AI feedback loop (ML) | เก็บ data ก่อน |
| A/B testing | มี data ก่อน |
| On-premise AI | ซับซ้อนเกินไป |
| Real-time learning | มี data ก่อน |

---

## สรุป

> **หลักการออกแบบ Hybrid AI สำหรับ Secretary:**
>
> 1. **AI failure must not become application failure** — rule-based parser ต้องทำงานได้เสมอ
> 2. **AI = Assistant, Secretary Core = Source of Truth** — AI ไม่แตะ balance, transaction, reconciliation
> 3. **User is the final judge** — ทุก AI output ต้องผ่าน user confirmation
> 4. **Simple First, Fast First, Safe Always** — เริ่มจาก rule-based, ค่อยเพิ่ม AI
> 5. **Silent failure คือศัตรูตัวร้ายที่สุด** — ต้อง detect และ flag ทุกครั้ง

---

**⚠️ ยังไม่ได้แก้ไข Specification ใด ๆ — รอ Review และ Approval**

**ขั้นตอนถัดไป:** รอการ review จากทีม แล้วจึงนำไปเขียน Hybrid AI Specification (Method 3) อย่างเป็นทางการ
