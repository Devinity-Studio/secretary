# Roadmap — MyDesk

อัปเดตล่าสุด: 2 กันยายน 2026

---

## Phase 0: Discovery & Spec (ปัจจุบัน)
**เป้าหมาย:** มีเอกสารชัดเจนและตัดสินใจ tech stack

- [x] Product Vision
- [x] Design Document
- [x] MVP Scope
- [x] Roadmap
- [ ] ตัดสินใจชื่อโปรเจกต์สุดท้าย
- [ ] ตั้ง Supabase project + schema เริ่มต้น
- [ ] สร้าง Expo project เปล่า

**ระยะเวลาโดยประมาณ:** 1-3 วัน

---

## Phase 1: Foundation (โครงสร้างพื้นฐาน)
**เป้าหมาย:** แอพเปิดได้, มี local DB, มี navigation, มี auth พื้นฐาน

- สร้าง Expo (TypeScript) project
- ตั้ง Tailwind / NativeWind
- Bottom Tab Navigation (Home, Finance, Journal, Calendar, Settings)
- Local Database (SQLite หรือ WatermelonDB)
- Schema: records, account_books, categories, settings
- Supabase client + Auth (Email + Guest)
- Zustand stores พื้นฐาน
- Theme + ภาษาไทย

**Deliverable:** แอพเปล่าที่ login ได้ + บันทึกข้อมูลลง local ได้

**ระยะเวลาโดยประมาณ:** 5-8 วัน

---

## Phase 2: Quick Capture + Core Records + Goals (หัวใจของ MVP)
**เป้าหมาย:** สั่งงานด้วยคำสั้น ๆ แล้วบันทึกได้จริง + มีเป้าหมายการออมที่ติดตามได้

- Quick Input component
- Rule-based Parser (ตัวเลข, ประเภท, วันที่, หมวด, บัญชี, **goal**)
- Preview Card
- สร้าง / แก้ไข / ลบ record
- Home screen แสดงสรุปวันนี้ + รายการ
- Finance list + filter พื้นฐาน
- Journal / Task list พื้นฐาน
- **Goals พื้นฐาน:**
  - สร้างเป้าหมาย (target + ระยะเวลา)
  - Goal Card แสดง current / target + เปอร์เซ็นต์
  - Contribution รายวัน
  - ไฮไลต์ช่วงวันบนปฏิทิน
  - คลิกวันที่ → อัปเดตยอดเก็บของวันนั้น

**Deliverable:** ผู้ใช้พิมพ์คำสั้น ๆ แล้วเห็นรายการขึ้นจริง + ตั้งเป้าหมายออมแล้วติดตามความคืบหน้าได้

**ระยะเวลาโดยประมาณ:** 9-12 วัน

---

## Phase 3: Sync + Polish MVP
**เป้าหมาย:** ซิงค์ได้ + ใช้งานลื่นพอสำหรับปล่อยทดสอบ

- Sync engine กับ Supabase (push/pull)
- Conflict handling อย่างง่าย
- สรุปเดือน
- จัดการบัญชีเงินและหมวดหมู่
- Empty states + Loading + Error handling
- Export JSON
- ทดสอบบนเครื่องจริง Android + iOS

**Deliverable:** MVP พร้อมให้คนใกล้ตัวลองใช้

**ระยะเวลาโดยประมาณ:** 5-7 วัน

---

## Phase 4: Smart & Calendar (หลัง MVP)
- ปรับปรุง Parser ให้ฉลาดขึ้น (ประวัติผู้ใช้ + กฎเพิ่ม)
- Calendar Month / Week view
- Reminder พื้นฐาน
- Dark mode
- Social Login (Google, Apple)
- Voice input (Speech-to-text)

---

## Phase 5: Advanced Intelligence
- Edge Function + LLM สำหรับ parse ภาษาธรรมชาติที่ซับซ้อน
- แนะนำหมวดหมู่และบัญชีอัตโนมัติแม่นยำขึ้น
- สรุปเชิงลึก (สัปดาห์/เดือน) + insight
- งบประมาณ (Budget)
- Widget
- Notification ที่ชาญฉลาด

---

## Phase 6: Desktop Reporting & Professional Use
- Web Dashboard (Next.js) สำหรับเดสก์ท็อป
- มุมมองหลายแบบ: ปฏิทิน / ตาราง (Grid) / ลิสต์
- กรองและค้นหาขั้นสูง
- สถานะเบิกงบ (reimbursement_status)
- ส่งออก CSV / Excel / PDF รายงานเบิกงบ
- แดชบอร์ดสรุปสำหรับนักบัญชีและคนทำงาน

## Phase 7: Scale & Polish
- Multi-language เต็มรูปแบบ
- Electron (ถ้าต้องการแอปติดตั้ง)
- Widget / Notification ขั้นสูง
- Team features เพิ่มเติม

---

## สรุป Timeline โดยประมาณ (MVP)

| Phase | งานหลัก | เวลาโดยประมาณ |
|-------|---------|----------------|
| 0 | Spec + ตัดสินใจ | 1-3 วัน |
| 1 | Foundation | 5-8 วัน |
| 2 | Quick Capture + Core | 7-10 วัน |
| 3 | Sync + Polish | 5-7 วัน |
| **รวมถึง MVP** | | **ประมาณ 3-5 สัปดาห์** |

*หมายเหตุ: เวลาขึ้นกับจำนวนคนและความเร็วในการตัดสินใจ*

---

## หลักการจัดลำดับความสำคัญ

1. **Quick Capture ต้องดีก่อน** — นี่คือเหตุผลหลักที่คนจะใช้ต่อ
2. **Offline ต้องใช้ได้** — อย่าพังตอนไม่มีเน็ต
3. **Sync ทำทีหลัง foundation** — แต่ต้องออกแบบ schema ให้รองรับตั้งแต่แรก
4. **AI ขั้นสูงไม่จำเป็นสำหรับ MVP** — เริ่มจาก rule-based ที่แม่นก่อน
