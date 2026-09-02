# Implementation Plan — MyDesk MVP

## 1. Tech Stack ที่ตัดสินใจใช้ (แนะนำ)

| ชั้น | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| Framework | **Expo (SDK ล่าสุด) + TypeScript** | พัฒนาเร็ว, OTA, รองรับ iOS/Android |
| UI | **NativeWind (Tailwind)** + React Native components | เร็ว, สม่ำเสมอ |
| Navigation | **Expo Router** (file-based) | ทันสมัยและจัดการง่าย |
| Local DB | **expo-sqlite** หรือ **WatermelonDB** | Offline-first |
| State | **Zustand** | เบา, เหมาะกับ offline |
| Backend | **Supabase** | Auth + Postgres + Realtime + Edge Functions |
| Form / Validation | Zod + React Hook Form (ถ้าจำเป็น) | Type-safe |
| Date | dayjs หรือ date-fns | เบา |
| Icon | lucide-react-native หรือ @expo/vector-icons | |

**ทางเลือกอื่นที่ยังเปิดไว้:**
- ถ้าต้องการ sync ขั้นสูงมาก → พิจารณา PowerSync กับ Supabase ภายหลัง

---

## 2. โครงสร้างโฟลเดอร์โปรเจกต์ (เสนอ)

```
mydesk/
├── app/                    # Expo Router
│   ├── (tabs)/
│   │   ├── index.tsx       # Home / วันนี้
│   │   ├── finance.tsx
│   │   ├── journal.tsx
│   │   ├── calendar.tsx
│   │   └── settings.tsx
│   ├── capture.tsx         # Quick Capture modal/sheet
│   ├── login.tsx
│   └── _layout.tsx
├── components/
│   ├── capture/
│   ├── records/
│   ├── finance/
│   ├── ui/
│   └── ...
├── lib/
│   ├── supabase.ts
│   ├── database.ts         # local db setup
│   ├── parser/             # smart short-command parser
│   ├── sync/
│   └── utils/
├── stores/                 # Zustand
│   ├── useRecordStore.ts
│   ├── useAuthStore.ts
│   ├── useSettingsStore.ts
│   └── ...
├── types/
│   └── index.ts
├── constants/
│   ├── categories.ts
│   └── ...
└── docs/                   # (ย้ายหรืออ้างอิงจาก artifacts)
```

---

## 3. Database Schema (Supabase + Local)

### records
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users(id),
type text not null, -- expense | income | transfer | task | event | note | journal
title text,
description text,
content text,
amount numeric,
currency text default 'THB',
category text,
account_book_id uuid,
to_account_book_id uuid, -- สำหรับ transfer
tags text[],
start_at timestamptz,
end_at timestamptz,
all_day boolean default false,
reminder_at timestamptz,
status text, -- todo | done | cancelled | active | completed | expired (สำหรับ task/goal)
parent_id uuid, -- ใช้ผูก contribution → goal
target_amount numeric, -- สำหรับ goal
current_amount numeric, -- cache ยอดรวมของ goal (optional, คำนวณได้จาก contribution)
metadata jsonb default '{}',
created_at timestamptz default now(),
updated_at timestamptz default now(),
deleted_at timestamptz
```

### account_books
```sql
id uuid primary key,
user_id uuid,
name text not null,
type text, -- cash | bank | credit | savings | other
color text,
icon text,
is_default boolean default false,
created_at timestamptz,
updated_at timestamptz,
deleted_at timestamptz
```

### categories
```sql
id uuid primary key,
user_id uuid, -- null = system default
name text not null,
type text, -- expense | income | both
icon text,
color text,
sort_order int
```

**หมายเหตุ:** Local DB ใช้โครงสร้างใกล้เคียงกันที่สุด เพื่อให้ sync ง่าย

---

## 4. ลำดับการลงมือทำ (Sprint-style)

### Sprint 0 — เตรียมของ (1-2 วัน)
1. สร้าง Expo project
2. ติดตั้ง dependencies หลัก
3. ตั้ง Supabase project + สร้างตาราง + RLS
4. ตั้ง Git repository
5. สร้าง constants หมวดหมู่เริ่มต้น (ภาษาไทย)

### Sprint 1 — Skeleton + Auth + Local DB (3-5 วัน)
1. Expo Router + Tab layout
2. Supabase Auth (email + anonymous/guest)
3. Local SQLite setup + migration
4. Zustand stores ว่าง ๆ
5. หน้า Settings เบื้องต้น + แสดงสถานะ login

### Sprint 2 — Record CRUD + Home (4-6 วัน)
1. Types + repository สำหรับ records
2. สร้าง / อ่าน / แก้ไข / ลบ record จาก local
3. Home screen แสดงรายการวันนี้ + สรุปตัวเลข
4. หน้า Finance list พื้นฐาน

### Sprint 3 — Quick Capture + Parser + Goals พื้นฐาน (6-9 วัน)
1. UI ช่องพิมพ์ + bottom sheet
2. Parser เวอร์ชัน 1 (regex + keyword dictionary) รวมคำสั่งสร้าง goal และ contribution
3. Preview card
4. เชื่อมกับการบันทึกจริง
5. สร้าง Goal record + Goal Card UI (current/target + %)
6. Contribution รายวัน + เชื่อม parent_id
7. ทดสอบประโยคตัวอย่างจำนวนมาก (รวม goal)

### Sprint 4 — Calendar Goal Highlight + Sync + Polish (5-8 วัน)
1. Calendar Month view + ไฮไลต์ช่วงวันของ Goal
2. คลิกวันที่ในปฏิทิน → อัปเดต/เพิ่ม contribution ของวันนั้น
3. อัปเดต current_amount ของ Goal อัตโนมัติ
4. Sync push / pull กับ Supabase
5. จัดการบัญชีเงิน
6. Empty state, loading, error
7. Export JSON
8. ทดสอบเครื่องจริง + แก้บั๊ก

---

## 5. Parser Implementation แนวทาง (สำคัญ)

**ไฟล์หลัก:** `lib/parser/index.ts`

Pipeline แนะนำ:
1. Normalize ข้อความ (ตัดช่องว่าง, แปลงเลขไทย, ลบ comma)
2. Extract amount (regex)
3. Detect type จาก keyword (รายรับ, โอน, นัด, งาน, ฯลฯ)
4. Detect date (วันนี้, พรุ่งนี้, วันจันทร์, วันที่ตัวเลข)
5. Detect category จาก dictionary
6. Detect account จากชื่อบัญชีที่มีในระบบ
7. สร้าง `ParsedResult` → แปลงเป็น partial Record
8. UI แสดง preview ให้ผู้ใช้ยืนยันหรือแก้

**เริ่มจาก rule-based ที่แม่นยำก่อน** แล้วค่อยเพิ่ม AI ทีหลังผ่าน Edge Function

---

## 6. ข้อควรระวังตอนลงมือ

- ออกแบบ `id` เป็น UUID ตั้งแต่แรก (ทั้ง local และ cloud)
- ใส่ `updated_at` และ `deleted_at` ทุกตารางหลัก
- RLS บน Supabase ต้องแน่น (user_id = auth.uid())
- อย่าให้ sync ทับข้อมูล local โดยไม่เช็ค
- Quick Capture ต้องรู้สึกเร็วมาก (อย่าเรียก network ตอน parse)
- ทดสอบ offline เป็นประจำ

---

## 7. ไฟล์เอกสารที่เกี่ยวข้อง

| ไฟล์ | เนื้อหา |
|------|--------|
| `01-product-vision.md` | วิสัยทัศน์และปัญหา |
| `02-design.md` | UI/UX + Architecture + Data model |
| `03-mvp.md` | ขอบเขต MVP ชัดเจน |
| `04-roadmap.md` | แผนระยะยาว |
| `05-implementation-plan.md` | แผนลงมือทำฉบับนี้ |

---

## 8. ขั้นตอนถัดไปทันที

1. ยืนยัน tech stack ตามที่เสนอ (หรือปรับ)
2. สร้าง Expo project ใน `/home/workdir/artifacts/mydesk`
3. สร้าง Supabase project และ schema
4. เริ่ม Sprint 0-1

พร้อมเริ่มสร้างโปรเจกต์จริงได้เลยเมื่อคุณสั่งครับ
