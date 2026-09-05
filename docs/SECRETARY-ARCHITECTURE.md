# SECRETARY

## Product & Architecture Continuation State

**Project:** Secretary
**Repository:** `Devinity-Studio/secretary`
**Document Status:** 🟢 Foundation / Ready for Structured Implementation
**Purpose:** ใช้เป็นฐานกลางสำหรับการพัฒนา Secretary ต่อจาก Current State
**Last Updated:** 5 September 2026

---

# 1. Executive Summary

Secretary คือ AI-native Personal Secretary / Personal Operating System ที่มีเป้าหมายไม่ใช่เพียง "ตอบคำถามผู้ใช้" แต่เป็นระบบที่ช่วยผู้ใช้ **เข้าใจ จัดการ เชื่อมโยง และติดตามสิ่งต่าง ๆ ที่เกิดขึ้นในชีวิตและการทำงาน**

หลักการสำคัญ:

> **Human gives intent; Secretary manages the details.**

Secretary ไม่ควรบังคับให้มนุษย์เรียนรู้ระบบ แต่ควรเรียนรู้วิธีทำงานของมนุษย์แทน

> **Secretary adapts the system to the boss, not the boss to the system.**

เป้าหมายด้านประสบการณ์:

> "นี่คือเลขาของผม"

ไม่ใช่:

> "ผมกำลังใช้แอป AI ตัวหนึ่ง"

---

# 2. Product Definition

Secretary ประกอบด้วยหลาย Layer ที่ทำงานร่วมกัน:

```text
                    SECRETARY
                         │
          ┌──────────────┴──────────────┐
          │                             │
    Intelligence Layer            Interaction Layer
          │                             │
    Context Engine                  Conversation
    Memory Engine                  Voice
    Relevance Engine               Workspace
    Relationship Engine            Notifications
          │                             │
          └──────────────┬──────────────┘
                         │
                  Continuity Layer
                         │
              Mobile / Desktop / Future
```

Secretary จึงไม่ใช่ Chatbot ที่มี Feature เพิ่มขึ้นเรื่อย ๆ

แต่เป็นระบบที่มี **Intelligence เป็นแกนกลาง** และให้แต่ละ Interface เป็นช่องทางที่เหมาะสมกับสถานการณ์

---

# 3. Core Philosophy

## 3.1 Human gives intent

ผู้ใช้ไม่ควรต้องอธิบายขั้นตอนทั้งหมด

ตัวอย่าง:

> "เลขา ช่วยจัดเรื่องประชุมกับคุณเอให้หน่อย"

Secretary ควรเข้าใจว่า:

* ใครเกี่ยวข้อง
* ต้องติดต่อใคร
* เวลาไหน
* เรื่องอะไร
* ต้องติดตามอะไร
* ต้องบันทึกอะไร
* ต้องแจ้งเตือนเมื่อใด

ผู้ใช้ให้ "เป้าหมาย"

Secretary จัดการ "รายละเอียด"

---

# 4. Context

Context เป็น Core Primitive ของ Secretary

Context ไม่ใช่เพียง Conversation History

แต่ประกอบด้วย:

* Current Situation
* User Intent
* Time
* Device
* Relevant People
* Projects
* Accounts
* Goals
* Decisions
* Actions
* Previous Events
* Current State
* Next Action
* Relevant External Information

Context ต้องสามารถ:

* Scoped
* Retrieved
* Linked
* Updated
* Expired
* Prioritized
* Expanded / Collapsed

---

# 5. Context Card

**Context Card คือ Universal Primitive ของ Secretary**

ใช้ได้ทั้ง Mobile และ Desktop

ระดับพื้นฐาน:

```text
Context Card
     ↓
Statement
     ↓
Evidence / Source
     ↓
Related Context
```

ตัวอย่าง:

```text
💰 เงินเข้า ฿15,000

KBank • xxxx1234
5 Sep 2026 • 14:32

ที่มา: xxxx1234
```

เมื่อผู้ใช้ต้องการรายละเอียด:

```text
Statement

เวลา
จำนวนเงิน
บัญชีต้นทาง
บัญชีปลายทาง
ผู้เกี่ยวข้อง
หมวดหมู่
Project
Evidence
Confidence
Related Events
```

หลักการ:

> **One Context — Multiple Levels of Visibility**

Mobile ไม่จำเป็นต้องแสดงทุกอย่าง

Desktop สามารถขยาย Context เดียวกันออกเป็น Statement และ Related Data ได้

---

# 6. Record First, Identify Later

Secretary ไม่ควรบังคับให้ผู้ใช้ระบุข้อมูลทั้งหมดก่อนจึงจะบันทึกได้

ตัวอย่าง:

ระบบพบ:

> เงินเข้า ฿15,000

แม้ยังไม่รู้ว่าเงินมาจากใคร ก็สามารถบันทึก Event ได้ก่อน

จากนั้น:

```text
Record
   ↓
Identify
   ↓
Relate
   ↓
Learn
```

ข้อมูลที่เป็น Fact ควรแยกจากสิ่งที่ AI Inference ขึ้นมา

```text
FACT
INFERENCE
ALERT
```

AI ไม่ควรเปลี่ยน Fact ของระบบเพียงเพราะคาดเดา

---

# 7. Memory

Memory คือข้อมูลระยะยาวที่มีความหมายต่อ Secretary

ตัวอย่าง:

* User Memory
* Project Memory
* Relationship Memory
* Decision Memory
* Preference Memory
* Historical Context

หลักสำคัญ:

> Secretary ไม่ควรเพียงจำว่า "เราเคยพูดอะไร"

แต่ควรจำว่า:

> **"เราเคยผ่านอะไรมาด้วยกัน"**

Memory จึงเป็นฐานที่ทำให้ Relationship และ Personalization ดีขึ้น

---

# 8. Relationship

Secretary มี Relationship State แยกจาก Personality

## Personality

คือ "เธอเป็นใคร"

## Relationship

คือ "เธอกับผู้ใช้สนิทกันแค่ไหน"

ดังนั้น:

```text
Personality ≠ Relationship Closeness
```

ผู้ใช้อาจเป็นคนพูดเล่นตั้งแต่ครั้งแรก

Secretary จึงสามารถตอบอย่างเป็นธรรมชาติได้โดยไม่จำเป็นต้องแสร้งว่าทั้งสองคนสนิทกันแล้ว

หลัก:

> **ความเป็นกันเอง ≠ ความสนิท**

Relationship ควรเกิดจากประสบการณ์ร่วมและพฤติกรรมจริง

และสามารถถอยกลับได้เมื่อ Trust เสีย

---

# 9. Observed Behavior ≠ Judgement

Secretary ควรเรียนรู้จากพฤติกรรมโดยไม่รีบตัดสินตัวตนของผู้ใช้

ตัวอย่าง:

```text
Observed:
ผู้ใช้ชอบพูดเล่น

ไม่ควรสรุป:
ผู้ใช้ไม่จริงจัง
```

หรือ:

```text
Observed:
ผู้ใช้ขอ Reminder บ่อย

ไม่ควรสรุป:
ผู้ใช้ขี้เกียจ
```

สิ่งที่ Memory ควรเก็บคือ **Observed Pattern**

ไม่ใช่การตีตราบุคลิก

---

# 10. Adaptive Behavior

Secretary ควรเรียนรู้ว่า:

* ผู้ใช้ชอบคุยแบบไหน
* ต้องการรายละเอียดระดับใด
* เวลาไหนควรพูด
* เวลาไหนควรเงียบ
* เรื่องใดสำคัญ
* เรื่องใดเป็น Noise
* เมื่อใดควรเสนอ
* เมื่อใดควรรอ

เป้าหมายคือ:

> **Secretary becomes better at working with this particular boss over time.**

---

# 11. Desktop / Secretary Workspace

Desktop ไม่ควรเป็น Mobile UI ที่ขยายใหญ่ขึ้น

Desktop คือ:

> **Thinking & Working Surface**

แนวคิดจาก MyDesk ถูกนำมาเป็น DNA ของ Secretary Workspace

```text
Secretary
├── Intelligence / Context
├── Workspace
│   ├── Main Area
│   ├── Context Panel
│   └── Secondary Panel
├── Mobile Experience
└── Domain Modules
    ├── Calendar
    ├── Finance
    ├── Goals
    └── Accounts
```

Mobile:

> "ทำอะไรตอนนี้"

Desktop:

> "เห็นอะไรบ้าง / กำลังทำอะไรอยู่"

---

# 12. Dynamic Workspace

Workspace สามารถเปลี่ยนตาม Cognitive Task ของผู้ใช้

ตัวอย่าง:

```text
กำลังดู
→ Context Card ใหญ่

กำลังตรวจสอบ
→ Card เล็ก
→ Statement ใหญ่

กำลังวิเคราะห์
→ Statement
→ Related Data
→ History

พอแล้ว
→ กลับ Context View
```

นี่ไม่ใช่เพียง Responsive UI

แต่คือ:

> **Secretary rearranges the desk according to what the boss is doing.**

---

# 13. Context Inertia

Workspace ไม่ควรเปลี่ยนทุกครั้งที่ผู้ใช้เปลี่ยน Keyword หรือถามคำถามข้างเคียง

Conversation สามารถเปลี่ยนเรื่องได้ทันที

แต่ Workspace ควรมี "แรงเฉื่อย"

```text
Conversation Layer
──────────────────
ถาม
คุยเล่น
ถามเรื่องข้างเคียง
เปลี่ยนประเด็นชั่วคราว

Workspace Context Layer
────────────────────────
สิ่งที่กำลังทำจริง
```

หลัก:

> **อย่าเปลี่ยนโต๊ะเพียงเพราะเจ้านายหันไปถามอะไรข้าง ๆ**

ระบบอาจรอให้เห็นว่า Topic ใหม่มีความต่อเนื่องจริง ก่อนเปลี่ยน Workspace

---

# 14. Desktop Voice / Ambient Interaction

Desktop สามารถมี Mic Lock / Always Ready Mode

แนวคิด:

ผู้ใช้เปิด Notebook/Desktop ทิ้งไว้

เดินไปชงกาแฟ

แล้วพูด:

> "เลขา วันนี้เรามีอะไรบ้าง?"

ไม่จำเป็นต้องกลับมาจับ Keyboard

Mic State:

```text
OFF
READY
LISTENING
PROCESSING
SPEAKING
```

สำคัญ:

> READY ≠ Record Everything

Mic Lock หมายถึง "พร้อมรับคำเรียก" ไม่ใช่การบันทึกผู้ใช้ตลอดเวลา

---

# 15. Multi-device

หลัก:

> **One Secretary, Every Device, Continuous Context**

Device เป็น Interface / Body

ไม่ใช่ Secretary คนละตัว

```text
                Secretary
                    │
        ┌───────────┼───────────┐
        │           │           │
      Mobile     Desktop     Future
        │           │
      Quick       Deep Work
      Intent      Workspace
```

บทบาท:

### Mobile

* Quick Action
* Voice
* Notification
* Summary
* Context Card

### Desktop

* Workspace
* Statement
* Analysis
* Rich Context
* Deep Work

อนาคต:

* Car
* Watch
* TV / Home
* IoT

หลัก:

> **Secretary doesn't follow you everywhere. Secretary simply doesn't disappear.**

---

# 16. Notification Intelligence

Notification เป็นเพียง Raw Signal

ไม่ใช่ Context โดยอัตโนมัติ

```text
Notification
     ↓
Understand
     ↓
Classify
     ↓
Context Match
     ↓
Relevance
     ↓
Priority
     ↓
Should I bother my boss?
```

ตัวอย่าง:

```text
โปรโมชั่นลด 50%
→ Noise

นัดประชุมพรุ่งนี้ 10 โมง
→ Candidate Appointment

เงินเข้า ฿15,000
→ Financial Event

ข่าว AI ที่เกี่ยวข้องกับ Project ปัจจุบัน
→ Relevant Information
```

หลัก:

> **Capture ≠ Automatically Create Record**

---

# 17. Email Intelligence

Email มี Metadata มากกว่า Notification

สามารถใช้:

* Sender
* Recipient
* Domain
* Subject
* Body
* Timestamp
* Thread
* Attachments
* Links

เพื่อจัดประเภทเบื้องต้น:

```text
Personal
Work
Project
Meeting
Finance
Invoice
Receipt
Security
Newsletter
Promotion
Social
Spam
```

แต่:

> **Type ≠ Importance**

Promotion อาจมีประโยชน์

Work Email อาจไม่สำคัญ

ดังนั้นต้องมีอย่างน้อย:

```text
1. What is this?
2. Does my boss care?
3. Does my boss need to know now?
```

---

# 18. Personal Relevance Engine

นี่คือความสามารถที่ต่อยอดจาก Notification + Email + Context + Memory

เป้าหมายไม่ใช่ให้ผู้ใช้เห็นข้อมูลมากขึ้น

แต่:

> **ให้ผู้ใช้เห็นเฉพาะข้อมูลที่มีคุณค่า**

Architecture:

```text
External World
      ↓
Email / Notification / News / Documents
      ↓
Signal Classification
      ↓
Context Matching
      ↓
User Interest
      ↓
Current Situation
      ↓
Priority
      ↓
Timing
      ↓
Secretary
```

ตัวอย่าง:

ผู้ใช้กำลังทำ AI Agent

มีข่าว AI Agent ใหม่เข้ามา

Secretary สามารถประเมิน:

```text
Topic Relevance      High
Project Relevance    High
User Interest        High
Urgency              Medium
```

แล้วอาจพูด:

> "มีเรื่องหนึ่งที่ผมคิดว่าน่าจะเป็นประโยชน์กับงานที่เรากำลังทำ ผมเก็บไว้ให้แล้วครับ"

ไม่ใช่ส่ง Feed 50 รายการ

---

# 19. Information Diet

Secretary ควรช่วยลด Information Overload

หลัก:

> **Secretary should not increase the amount of information the user receives.**

แต่ควรเพิ่ม:

> **Signal-to-Noise Ratio**

ดังนั้น Secretary ต้องเรียนรู้ทั้ง:

```text
What the user likes
+
What the user needs
+
What the user is currently doing
+
What the user repeatedly ignores
```

สิ่งที่ผู้ใช้ไม่สนใจซ้ำ ๆ สามารถลด Priority ลงได้

แต่ไม่ควรลบทิ้งจาก Fact โดยอัตโนมัติ

---

# 20. Secretary-to-Secretary Network

Secretary สามารถสื่อสารกับ Secretary ของผู้ใช้อื่น

ไม่ใช่เพียง Shared Reminder

แต่เป็น:

> **Secretary-to-Secretary Communication**

ตัวอย่าง:

```text
Secretary A
↓
Meeting Request

Secretary B
↓
Inform User B

User B
↓
Counter Proposal

Secretary B
↓
Meeting Response

Secretary A
↓
Inform User A

User A
↓
Accept

Secretary A + B
↓
Canonical Shared Event
```

---

# 21. Canonical Shared Context

ห้ามสร้าง Calendar Event แยกกันสองอันแล้วหวังว่าข้อมูลจะตรงกัน

ควรมี:

```text
Canonical Shared Context
          │
          ├── User A Representation
          └── User B Representation
```

ดังนั้นถ้าเวลาเปลี่ยน:

```text
Shared Event
10:00
   ↓
11:00
```

ทั้งสองฝ่ายได้รับการ Update จาก Context เดียวกัน

---

# 22. Conversation → Agreement → Memory

Secretary-to-Secretary มีคุณค่ามากกว่าการส่งข้อความ

เพราะ:

> **Conversation creates the agreement.
> Secretary preserves the agreement.**

Flow:

```text
Conversation
     ↓
Agreement
     ↓
Shared Context
     ↓
Calendar
     ↓
Reminder
     ↓
Notification
```

สิ่งที่มนุษย์ตกลงกันจึงไม่หายไปพร้อมกับ Conversation

---

# 23. External Tool Philosophy

Secretary ไม่จำเป็นต้องเป็นเจ้าของทุก Tool

หลัก:

> **Secretary understands and coordinates the tools the user already uses.**

ตัวอย่าง:

```text
Phone
 └── Clock / Alarm

Google
 └── Calendar

Bank
 └── Banking System

Secretary
 └── Context Engine
```

Secretary ทำหน้าที่เชื่อมความหมายระหว่างสิ่งเหล่านี้

ไม่ใช่แทนที่ทุกระบบ

---

# 24. Finance Context

Financial Event สามารถมี:

* Direction
* Transaction Type
* Source Account
* Destination Account
* Person / Entity
* Category
* Purpose
* Project
* Goal
* Budget
* Constraint
* Evidence
* Confidence

Transaction Type:

```text
Income
Expense
Transfer
Saving
Refund
Debt
Adjustment
```

Source:

```text
Bank
Email
Notification
Slip
User
```

AI ช่วยทำความเข้าใจ

แต่:

> **AI ไม่ใช่ Ledger**

Source of Truth ต้องแยกจาก AI Interpretation

---

# 25. Evidence & Reconciliation

หลาย Source สามารถอ้างถึงเหตุการณ์เดียวกัน

ตัวอย่าง:

```text
Bank Notification
Email
Payment Slip
User Statement
      ↓
   Evidence
      ↓
Canonical Event
```

ถ้าข้อมูลขัดแย้งกัน:

> **Alert — ไม่สุ่มเลือกคำตอบ**

---

# 26. Core Data Philosophy

หลักสำคัญ:

### Fact

สิ่งที่ระบบมีหลักฐาน

### Inference

สิ่งที่ AI ประเมิน

### Context

ความหมายที่เชื่อมโยงจากหลาย Fact

### Memory

สิ่งที่ควรรักษาในระยะยาว

### Relationship

สิ่งที่ระบบเรียนรู้จากประสบการณ์ร่วม

```text
Fact
 ↓
Context
 ↓
Memory
 ↓
Relationship
 ↓
Better Decisions
```

---

# 27. Business Model

หลักที่ตกลงกันแล้ว:

> **Basic relationship / basic usefulness = Generous / Free**

ไม่ควร Paywall:

* Core Context
* Context Card
* Statement
* Desktop Workspace
* Basic Voice
* Basic Multi-device Continuity
* Basic Relationship

เพราะถ้าผู้ใช้ถูกบอกว่า:

> "ฟีเจอร์นี้อยู่ใน Pro ค่ะ"

ความรู้สึกจะเปลี่ยนจาก:

> "นี่คือเลขาของผม"

เป็น:

> "ผมกำลังใช้ Software"

---

# 28. Premium Philosophy

Premium ไม่ควรหมายถึง:

> "เห็นได้มากขึ้น"

แต่ควรหมายถึง:

> **"Secretary ทำงานให้ได้มากขึ้น"**

Enterprise ในอนาคตสามารถเพิ่ม:

* Team Workspace
* Shared Organizational Context
* Advanced Analytics
* Permission / Role
* Department / Project Context
* Enterprise Knowledge
* Workflow
* Automation
* Audit Trail
* Enterprise Integrations
* SSO
* Security / Compliance
* Specialized Secretaries / Agents

แต่ไม่ควรเร่งสร้าง Enterprise ก่อน Core Experience แข็งแรง

---

# 29. Current Architecture Direction

Repository ปัจจุบันมี Foundation ที่เหมาะสมสำหรับการพัฒนาต่อ

Technology Foundation:

```text
TypeScript
React 19
Vite
TanStack Router / Start
Zustand
React Query
react-resizable-panels
Supabase SSR / Client
Kysely
pg
PGlite
Recharts
Radix UI
```

โดยเฉพาะ:

```text
react-resizable-panels
```

เหมาะกับแนวคิด Workspace ที่สามารถเปลี่ยนสัดส่วนของ:

* Context
* Statement
* Related Data
* Main Work Area

แบบ Dynamic ได้

**ไม่ควร Rebuild จากศูนย์**

ควรตรวจสอบ Current Components และค่อย ๆ ยกระดับ Architecture จาก Foundation ที่มีอยู่

---

# 30. Recommended Implementation Order

ลำดับที่ควรเดินต่อ:

```text
1. Context Model
        ↓
2. Context Card Primitive
        ↓
3. Statement / Detail View
        ↓
4. Workspace Shell
        ↓
5. Dynamic Workspace
        ↓
6. Context Inertia
        ↓
7. Voice / Desktop Interaction
        ↓
8. Notification Intelligence
        ↓
9. Email Intelligence
        ↓
10. Personal Relevance Engine
        ↓
11. Memory
        ↓
12. Relationship
        ↓
13. Multi-device Continuity
        ↓
14. Secretary-to-Secretary
```

ไม่ควรกระโดดไปสร้าง Network ก่อนที่ Context Model จะมั่นคง

---

# 31. Product Priority

ทุก Feature ใหม่ควรถูกตรวจด้วยคำถาม:

### Question 1

> สิ่งนี้ช่วยลดงานของผู้ใช้หรือไม่?

### Question 2

> Secretary เข้าใจ Context ได้ดีขึ้นหรือไม่?

### Question 3

> มันทำให้ผู้ใช้ต้องจัดการระบบมากขึ้นหรือไม่?

ถ้าคำตอบคือ:

> Feature เพิ่มขึ้น แต่ภาระผู้ใช้เพิ่มขึ้น

ให้ถือว่า **ยังไม่ใช่ Secretary ที่ดี**

---

# 32. North Star Experience

ประสบการณ์ที่เราต้องการ:

ผู้ใช้เปิด Notebook ตอนเช้า

Secretary อยู่บนโต๊ะ

```text
Good morning.

วันนี้มี 3 เรื่องที่ผมคิดว่าคุณควรรู้

09:00  Team Meeting
14:30  เงินเข้า ฿15,000
18:00  นัดหมาย

มีอะไรให้ผมช่วยไหมครับ?
```

ผู้ใช้เดินไปชงกาแฟ

พูด:

> "เลขา วันนี้มีอะไรสำคัญบ้าง?"

Secretary สรุปให้

จากนั้นผู้ใช้กลับมาที่โต๊ะ

พูด:

> "เรื่องเงินขยายให้ผมดูหน่อย"

Context Card ย่อ

Statement ขยาย

ผู้ใช้:

> "แล้วเงินนี้เกี่ยวข้องกับใคร?"

Related Context เปิด

นี่คือ:

> **Conversation → Workspace → Context**

โดยไม่ต้องให้ผู้ใช้เรียนรู้ UI ก่อน

---

# 33. The Secretary Principle

Secretary ไม่ควรรายงานทุกสิ่งที่เห็น

เลขาที่ดีจะรู้ว่า:

> **อะไรควรพูด**
>
> **อะไรควรรอ**
>
> **อะไรควรจำ**
>
> **อะไรควรทำ**
>
> **อะไรไม่ควรรบกวนเจ้านาย**

ดังนั้นก่อน Notification / Email / Information ทุกครั้ง ควรมีคำถามภายใน:

> **"Should I bother my boss?"**

---

# 34. Final Product Principle

Secretary ไม่ได้สร้างคุณค่าจาก Feature จำนวนมาก

คุณค่าเกิดจากการเชื่อมโยง:

```text
Context
   ↓
Memory
   ↓
Relationship
   ↓
Relevance
   ↓
Priority
   ↓
Action
   ↓
Continuity
```

และท้ายที่สุด:

> **Secretary ไม่ได้ทำให้ผู้ใช้รับข้อมูลมากขึ้น**
>
> **Secretary ทำให้ผู้ใช้มีเวลาสนใจสิ่งที่สำคัญมากขึ้น**

---

# 35. Current State — One Sentence

> **Secretary is an adaptive AI personal secretary that understands context, remembers what matters, learns the relationship with its user, filters the outside world for relevance, coordinates actions across people and devices, and presents exactly the right amount of information at the right time.**

---

# 36. Development Anchor

จากเอกสารฉบับนี้ การพัฒนาต่อควรถือว่า:

```text
                    SECRETARY
                        │
                ┌───────┴───────┐
                │               │
             CONTEXT         RELATIONSHIP
                │               │
          ┌─────┼─────┐         │
          │     │     │         │
       Memory  Relevance       Trust
          │     │     │         │
          └─────┼─────┴─────────┘
                │
             WORKSPACE
                │
        ┌───────┼────────┐
        │       │        │
      Mobile  Desktop   Voice
        │       │        │
        └───────┼────────┘
                │
          CONTINUITY
                │
       ┌────────┴────────┐
       │                 │
   External World    Other Secretaries
```

**Context คือแกนกลาง**

**Workspace คือพื้นที่ที่ Context ปรากฏ**

**Memory คือสิ่งที่อยู่ต่อเมื่อเวลาผ่านไป**

**Relationship คือสิ่งที่ทำให้ Secretary เข้าใจ "เจ้านายคนนี้"**

**Relevance คือสิ่งที่ป้องกันโลกภายนอกไม่ให้ถาโถมเข้ามารบกวน**

และ

> **Secretary คือสิ่งที่เชื่อมทั้งหมดเข้าด้วยกัน**

---

# Appendix A: Context Domain Model Specification

> **Status:** ✅ IMPLEMENTED — `src/lib/context/types.ts`, `src/lib/context/store.ts`

## A.1 Architecture Principle

```
Context is the DOMAIN MODEL.
UI (Context Card, Statement, Evidence panel) are VIEWERS of Context, not the model itself.
```

```text
                 ┌──────────────┐
                 │   Sources   │
                 │             │
                 │ Voice       │
                 │ Email       │
                 │ Notification│
                 │ Calendar     │
                 │ User        │
                 └──────┬───────┘
                        ↓
                ┌────────────────┐
                │  Context     │
                │  Canonical   │
                └───────┬────────┘
                        ↓
              ┌─────────┴─────────┐
              ↓                   ↓
       Context Card           Statement
              ↓                   ↓
        Evidence/Detail      Evidence/Detail
```

## A.2 Key Constraints

### 1. Context is Source of Truth
- `statement` (if present) is **CACHED/DERIVED** for display, not canonical
- Statement can be **regenerated from Facts** at any time
- UI must NOT be a dependency of the domain model

### 2. Evidence / Fact / Inference are Strictly Separated
```
Evidence (raw observation)
    ↓ supports
Fact (proven data point)
    ↓ + Evidence
Inference (AI assessment, traces back to Evidence/Facts)
```

### 3. Lifecycle Status is Separated from Change History
- **Lifecycle**: `tentative` → `confirmed` → `completed` / `cancelled` (NO "changed")
- **Change History**: separate event log for transitions and value changes

### 4. Record First, Identify Later
- Context can be created with **minimal data** (only Evidence required)
- Enrichment happens through separate operations
- No schema enforcement requiring all relations at creation

### 5. Source ≠ Evidence
- **Source** = channel/pathway (user, voice, email, notification, calendar, external, ai)
- **Evidence** = specific proof items; multiple evidence can come from different sources

### 6. Related Context supports Future Shared Context
- Context ↔ Context relationships
- Ready for future: Shared Context ↔ Participant / Secretary

## A.3 Type Hierarchy

### SourceType
```typescript
type SourceType = "user" | "voice" | "email" | "notification" | "calendar" | "external" | "ai"
```

### Evidence (Immutable Proof)
```typescript
interface Evidence {
  id: string
  sourceType: SourceType
  sourceId: string | null      // e.g., email ID, notification ID, bank TXN ID
  content: EvidenceContent      // { kind: "text" | "structured" | "hybrid" }
  capturedAt: string            // ISO timestamp
  confidence: ConfidenceLevel   // "high" | "medium" | "low" | "unknown"
}
```

### Fact (Proven Data Point)
```typescript
interface Fact {
  id: string
  evidenceIds: string[]         // MUST trace back to Evidence (provenance)
  field: string                // e.g., "amount", "date", "recipient"
  value: unknown
  establishedAt: string         // ISO timestamp
}
```

### Inference (AI Assessment)
```typescript
interface Inference {
  id: string
  evidenceIds: string[]         // MUST trace back to Evidence
  factIds: string[]            // MAY trace to Facts
  field: string
  value: unknown
  confidence: ConfidenceLevel
  reasoning: string             // MUST reference evidence/facts
  inferredAt: string
  confirmable: boolean
  confirmed: boolean
}
```

### LifecycleStatus
```typescript
type LifecycleStatus = "tentative" | "confirmed" | "cancelled" | "completed"

const LIFECYCLE_TRANSITIONS = {
  tentative: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],  // Terminal
  completed: []   // Terminal
}
```

### ChangeEvent (History)
```typescript
type ChangeEventType =
  | "created"
  | "field_updated"
  | "status_transition"
  | "evidence_added"
  | "fact_added"
  | "inference_added"
  | "inference_confirmed"
  | "inference_rejected"
  | "link_added"
  | "link_removed"
  | "enriched"
```

### EntityLink (Optional Relations)
```typescript
type EntityType = "person" | "account" | "project" | "event" | "goal" | "document" | "conversation" | "context"

interface EntityLink {
  id: string
  entityType: EntityType
  entityId: string
  label: string
  relationship: string          // e.g., "sender", "recipient", "source"
  source: "user" | "ai"
  createdAt: string
}
```

### RelatedContext (Context-to-Context)
```typescript
type ContextRelationType = "parent" | "child" | "related" | "derived" | "converges"

interface RelatedContext {
  id: string
  relatedContextId: string
  relationType: ContextRelationType
  description: string
  source: "user" | "ai" | "system"
  createdAt: string
}
```

### SecretaryContext (Canonical Model)
```typescript
interface SecretaryContext {
  id: string
  type: string                 // e.g., "financial.transaction", "calendar.event"

  // Lifecycle
  lifecycle: LifecycleStatus

  // Evidence & Facts & Inferences
  evidenceIds: string[]
  facts: Fact[]
  inferences: Inference[]

  // Sources
  primarySource: SourceType
  sources: SourceType[]         // All contributing sources

  // Relations
  links: EntityLink[]           // Optional — can be added later
  relatedContexts: RelatedContext[]

  // History (append-only)
  history: ChangeEvent[]

  // Timestamps
  createdAt: string
  updatedAt: string
  createdBy: "user" | "ai" | "system"

  // Optional
  expiresAt: string | null
  priority: number             // 0-100
  tags: string[]
  archived: boolean

  // Future S2S support
  sharedWithUserIds: string[] | null
  canonicalId: string | null
}
```

## A.4 Context Creation Flow

```text
User: "เงินเข้า 15000"

         ↓
  CreateContext({
    evidence: {
      sourceType: "user",
      content: { kind: "text", text: "เงินเข้า 15000" }
    }
  })
         ↓
  ┌────────────────────────────────────────┐
  │ Context (tentative)                     │
  │ - evidenceIds: ["ev-1"]               │
  │ - facts: []                            │
  │ - inferences: []                       │
  │ - links: []                            │
  └────────────────────────────────────────┘
         ↓ (later enrichment)
  addFact({ evidenceIds: ["ev-1"], field: "amount", value: 15000 })
         ↓
  ┌────────────────────────────────────────┐
  │ Context (tentative)                     │
  │ - facts: [{ field: "amount", value: 15000 }]
  └────────────────────────────────────────┘
         ↓ (more enrichment)
  addLink({ entityType: "account", entityId: "kbank-001", ... })
         ↓
  ┌────────────────────────────────────────┐
  │ Context (tentative)                     │
  │ - facts: [...]                         │
  │ - links: [{ entityType: "account", ... }]
  └────────────────────────────────────────┘
         ↓ (user confirms)
  transitionLifecycle("confirmed")
```

## A.5 Multiple Sources → One Context

```text
Email: "นัดประชุม 10:00"
   ↓
Notification: "เปลี่ยนเป็น 11 โมง"
   ↓
Calendar: "Event at 11:00"
   ↓
         ↓ All converge to ONE Context
┌────────────────────────────────────────┐
│ Context (Meeting)                        │
│ - evidenceIds: [email-ev, notif-ev, cal-ev]
│ - sources: ["email", "notification", "calendar"]
│ - facts: [{ field: "time", value: "11:00" }]
└────────────────────────────────────────┘
```

## A.6 Definition of Done (Step 1.1)

| # | Criteria | Status |
|---|----------|--------|
| 1 | Context Model is domain-first | ✅ |
| 2 | UI is not a dependency of the model | ✅ |
| 3 | Fact/Inference/Evidence separated | ✅ |
| 4 | Provenance traceable | ✅ |
| 5 | Lifecycle vs Change History separated | ✅ |
| 6 | Record First, Identify Later works | ✅ |
| 7 | Multiple Sources converge to one Context | ✅ |
| 8 | Related Context supports future S2S | ✅ |
| 9 | Domain behavior tests pass | ⏳ |
| 10 | Documentation is source of truth | ✅ (this doc) |

## A.7 Files

| File | Purpose |
|------|---------|
| `src/lib/context/types.ts` | Canonical type definitions |
| `src/lib/context/store.ts` | Zustand store for Context state |
| `src/lib/context/context.test.ts` | Domain behavior tests |

## A.8 Next Steps (Step 1.2+)

- **Step 1.2**: ContextCard Primitive — UI component that VIEWs Context
- **Step 1.3**: Statement View — derived from Facts
- **Step 2.1**: Workspace Layout — Context appears in Workspace
