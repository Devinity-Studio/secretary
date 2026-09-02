# Database Design — Goal System (ฉบับสมบูรณ์)

> รองรับเป้าหมายเดี่ยว + เป้าหมายร่วม (หลายคน)  
> รองรับการแสดงความยินดีเมื่อบรรลุเป้าหมาย  
> รองรับทั้งออมเงินและเป้าหมายแบบนิสัย

---

## 1. ประเภทเป้าหมายที่รองรับ

| ประเภท | ตัวอย่าง | วิธีวัดความสำเร็จ |
|--------|---------|------------------|
| **Savings** | เก็บเงิน 5,000 บาท ใน 30 วัน | รวมยอดเงิน (cumulative) |
| **Habit / Count Days** | วิ่งรอบหมู่บ้าน 30 วัน ต้องได้อย่างน้อย 25 วัน | นับจำนวนวันที่ทำสำเร็จ |
| **Quantity** | อ่านหนังสือ 12 เล่ม ใน 3 เดือน | รวมจำนวนชิ้น/ครั้ง |
| **Shared Goal** | ผม + แฟน เก็บเงิน 5,000 ด้วยกัน | รวมยอดจากทุกคนในกลุ่ม |

---

## 2. แนวคิดหลักที่ขยาย

### 2.1 แสดงความยินดีเมื่อบรรลุเป้าหมาย (Celebration)

เมื่อเป้าหมายเปลี่ยนสถานะเป็น `completed` หรือ `achieved_early`:

- ระบบแสดง **Celebration Screen / Modal** 
- มีข้อความให้กำลังใจแบบสุ่มหรือตามประเภทเป้าหมาย
- สามารถมี confetti / animation เบา ๆ ได้
- ผู้ใช้กด “ขอบคุณ” หรือ “ปิด” เพื่อกลับไปหน้าหลัก

**ตัวอย่างข้อความ:**
- “สุดยอดมาก! คุณทำได้แล้ว ”
- “ยินดีด้วยนะ เป้าหมายนี้สำเร็จแล้ว!”
- “เก่งมาก ที่วินัยขนาดนี้”
- “คุณกับคนสำคัญทำสำเร็จด้วยกันแล้ว!” (กรณี shared)

ข้อความเก็บใน `celebration_messages` หรือ hardcode ในแอพก่อนก็ได้

### 2.2 เป้าหมายร่วม (Collaborative / Shared Goal)

ตัวอย่าง: “เก็บเงิน 5,000 บาท” โดยมีสมาชิก 2 คน (ผม + แฟน)

- มีเจ้าของเป้าหมาย (owner)
- สามารถเชิญคนอื่นเข้ามาเป็นสมาชิกได้
- ยอด contribution ของทุกคนรวมกันเป็นความคืบหน้าของ goal
- แต่ละคนยังเห็นว่าตัวเองใส่ไปเท่าไหร่
- สมาชิกสามารถเพิ่ม contribution ของตัวเองได้

---

## 3. ตารางหลัก

### 3.1 `goals`

```sql
CREATE TABLE goals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title                     TEXT NOT NULL,
  description               TEXT,
  goal_type                 TEXT NOT NULL DEFAULT 'savings',  
  -- savings | habit | quantity | general

  status                    TEXT NOT NULL DEFAULT 'active',
  -- active | achieved_early | completed | cancelled | expired | failed

  measurement_type          TEXT NOT NULL DEFAULT 'cumulative',
  -- cumulative | count_days | streak

  target_value              NUMERIC(15,2) NOT NULL,
  current_value             NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit                      TEXT DEFAULT 'THB',

  -- สำหรับแบบ count_days
  total_days                INTEGER,
  min_success_days          INTEGER,

  -- ช่วงเวลา
  start_date                DATE NOT NULL,
  end_date                  DATE NOT NULL,

  -- การจัดการเมื่อสำเร็จก่อนเวลา
  continue_after_achieved   BOOLEAN NOT NULL DEFAULT false,
  achieved_at               TIMESTAMPTZ,

  -- Shared goal
  is_shared                 BOOLEAN NOT NULL DEFAULT false,

  -- การแสดงผล
  color                     TEXT DEFAULT '#8B5CF6',
  icon                      TEXT,

  -- ข้อความแสดงความยินดี (optional เก็บเองได้)
  celebration_message       TEXT,

  metadata                  JSONB DEFAULT '{}',

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);
```

**หมายเหตุ:** เปลี่ยนจาก `user_id` เป็น `owner_id` เพื่อแยกเจ้าของกับสมาชิกชัดเจน

---

### 3.2 `goal_members` (สมาชิกของเป้าหมายร่วม)

```sql
CREATE TABLE goal_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id           UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role              TEXT NOT NULL DEFAULT 'member',  -- owner | member
  status            TEXT NOT NULL DEFAULT 'active',  -- active | invited | left | removed

  -- ยอดที่สมาชิกคนนี้ใส่ไปทั้งหมด (cache)
  contributed_value NUMERIC(15,2) NOT NULL DEFAULT 0,

  invited_by        UUID REFERENCES auth.users(id),  -- คนที่เชิญ
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (goal_id, user_id)
);
```

**การใช้งาน:**
- เมื่อสร้าง goal → ใส่ owner ลงใน `goal_members` ด้วย role = 'owner'
- เชิญคนอื่น → สร้างแถว role = 'member', status = 'invited'
- เมื่อคนนั้นยอมรับ → เปลี่ยน status เป็น 'active'

---

### 3.3 `goal_contributions`

```sql
CREATE TABLE goal_contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id             UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- คนที่ใส่ยอด

  amount              NUMERIC(15,2) NOT NULL DEFAULT 1,
  contribution_date   DATE NOT NULL,
  is_success          BOOLEAN NOT NULL DEFAULT true,

  note                TEXT,
  linked_record_id    UUID,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,

  -- อนุญาตให้คนละคนใส่ในวันเดียวกันได้ (shared goal)
  UNIQUE (goal_id, user_id, contribution_date)
);
```

---

### 3.4 `goal_invitations` (ข้อความเชิญ + สถานะการเชิญ)

```sql
CREATE TABLE goal_invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id           UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  inviter_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ผู้ถูกเชิญ (รองรับทั้งคนที่มีบัญชีแล้ว และยังไม่มี)
  invitee_user_id   UUID REFERENCES auth.users(id),      -- ถ้ามีบัญชีในระบบแล้ว
  invitee_email     TEXT,                                 -- เชิญด้วยอีเมล
  invitee_phone     TEXT,                                 -- เชิญด้วยเบอร์โทร (optional)
  invitee_name      TEXT,                                 -- ชื่อที่แสดงในข้อความเชิญ

  -- ข้อความเชิญ
  message           TEXT,                                 -- ข้อความส่วนตัวจากผู้เชิญ
  invite_code       TEXT UNIQUE NOT NULL,                 -- รหัสเชิญสั้น ๆ สำหรับแชร์
  invite_link       TEXT,                                 -- deep link เต็ม

  status            TEXT NOT NULL DEFAULT 'pending',
  -- pending | accepted | declined | expired | cancelled

  expires_at        TIMESTAMPTZ,                          -- ลิงก์หมดอายุเมื่อไหร่
  responded_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**จุดประสงค์ของตารางนี้:**
- เก็บประวัติการเชิญทั้งหมด
- รองรับการเชิญคนที่ยังไม่มีบัญชีในระบบ (ผ่านอีเมล/ลิงก์)
- มี `invite_code` สำหรับแชร์แบบสั้น ๆ (เช่น ผ่าน LINE, ข้อความ)
- สามารถแนบข้อความส่วนตัวได้

### 3.5 `celebration_messages` (optional – สำหรับสุ่มข้อความ)

```sql
CREATE TABLE celebration_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_type       TEXT,                     -- null = ใช้ได้กับทุกประเภท
  is_shared       BOOLEAN DEFAULT false,    -- ข้อความสำหรับเป้าหมายร่วม
  message         TEXT NOT NULL,
  language        TEXT DEFAULT 'th',
  is_active       BOOLEAN DEFAULT true
);
```

ตัวอย่างข้อมูล:
```sql
INSERT INTO celebration_messages (message, is_shared) VALUES
('สุดยอดมาก! คุณทำได้แล้ว ', false),
('ยินดีด้วยนะ เป้าหมายนี้สำเร็จแล้ว!', false),
('เก่งมาก ที่วินัยขนาดนี้', false),
('คุณกับคนสำคัญทำสำเร็จด้วยกันแล้ว! ', true),
('ทีมเวิร์คเยี่ยมมาก เป้าหมายร่วมสำเร็จแล้ว!', true);
```

---

## 4. ตรรกะสำคัญ

### 4.1 คำนวณ current_value ของ Goal

```text
current_value = SUM(amount) จาก goal_contributions ทั้งหมดของ goal นี้
(หรือ COUNT กรณี count_days)
```

### 4.2 คำนวณยอดของแต่ละสมาชิก

```text
goal_members.contributed_value = SUM(amount) 
จาก contributions ของ user_id คนนั้นใน goal นี้
```

### 4.3 เมื่อบรรลุเป้าหมาย

1. ตั้ง `status = 'completed'` หรือ `'achieved_early'`
2. ตั้ง `achieved_at = now()`
3. UI ดึงข้อความจาก `celebration_messages` (หรือใช้ข้อความที่กำหนดใน goal)
4. แสดง Celebration Modal

### 4.4 Shared Goal + Invitation Flow

```
Owner สร้าง Goal (is_shared = true)
    ↓
ระบบเพิ่ม Owner ลง goal_members (role = owner, status = active)
    ↓
Owner กด “เชิญคนอื่น”
    ↓
┌─────────────────────────────────────────────┐
│  เลือกวิธีเชิญ                              │
│  • ค้นหาจากรายชื่อเพื่อนในแอพ               │
│  • ใส่เบอร์โทร / อีเมล                      │
│  • แชร์ลิงก์ / รหัสเชิญ (LINE, ข้อความ ฯลฯ) │
└─────────────────────────────────────────────┘
    ↓
ระบบสร้าง goal_invitations
  - สร้าง invite_code (เช่น "A7K9M2")
  - สร้าง invite_link (deep link)
  - บันทึกข้อความเชิญ (ถ้ามี)
    ↓
ส่งข้อความเชิญ (ตัวอย่าง):
  "คุณ [ชื่อ] เชิญคุณเข้าร่วมเป้าหมาย
   “เก็บเงินเที่ยวด้วยกัน 5,000 บาท”
   กดลิงก์เพื่อเข้าร่วม: https://mydesk.app/invite/A7K9M2
   หรือใส่รหัส A7K9M2 ในแอพ"
    ↓
ผู้ถูกเชิญเปิดลิงก์ / ใส่รหัส
    ↓
┌──────────────────┬──────────────────┐
│  ยอมรับ           │  ปฏิเสธ          │
│  status=accepted  │  status=declined │
│  เพิ่มเป็น member │                  │
└──────────────────┴──────────────────┘
    ↓
ทุกคนที่เป็น member สามารถเพิ่ม contribution ได้
ยอดรวมของทุกคน = ความคืบหน้า goal
```

### 4.5 ข้อความเชิญ (ตัวอย่างที่ระบบสร้างให้อัตโนมัติ)

**ภาษาไทย:**
```
คุณ [ชื่อผู้เชิญ] เชิญคุณเข้าร่วมเป้าหมาย

“[ชื่อเป้าหมาย]”
เป้าหมาย: [target] [unit]
ระยะเวลา: [start] ถึง [end]

[ข้อความส่วนตัวจากผู้เชิญ ถ้ามี]

กดลิงก์เพื่อเข้าร่วม:
https://mydesk.app/invite/[invite_code]

หรือเปิดแอพแล้วใส่รหัส: [invite_code]
```

**กรณีเชิญผ่าน LINE / แชร์:**
- ใช้ Share Sheet ของมือถือ
- แนบข้อความ + ลิงก์

---

## 5. ตัวอย่างข้อมูล

### Goal ร่วม (ผม + แฟน)
```json
{
  "id": "goal-001",
  "owner_id": "user-me",
  "title": "เก็บเงินเที่ยวด้วยกัน",
  "goal_type": "savings",
  "measurement_type": "cumulative",
  "target_value": 5000,
  "current_value": 3200,
  "is_shared": true,
  "status": "active",
  "start_date": "2026-09-02",
  "end_date": "2026-10-02"
}
```

### Members
```json
[
  {
    "goal_id": "goal-001",
    "user_id": "user-me",
    "role": "owner",
    "contributed_value": 1800
  },
  {
    "goal_id": "goal-001",
    "user_id": "user-girlfriend",
    "role": "member",
    "contributed_value": 1400
  }
]
```

### เมื่อสำเร็จ
- แสดงข้อความ: “คุณกับคนสำคัญทำสำเร็จด้วยกันแล้ว! ”
- แสดงยอดรวม 5,000 / 5,000
- แสดงว่าแต่ละคนใส่ไปเท่าไหร่

---

## 6. RLS แนวทาง (Supabase)

```sql
-- goals: เห็นได้ถ้าเป็น owner หรือเป็น member
CREATE POLICY "Members can view goal"
ON goals FOR SELECT
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM goal_members gm
    WHERE gm.goal_id = goals.id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  )
);

-- contributions: ใส่ได้เฉพาะสมาชิก
CREATE POLICY "Members can insert contribution"
ON goal_contributions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM goal_members gm
    WHERE gm.goal_id = goal_contributions.goal_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  )
);
```

---

## 7. UI ที่เกี่ยวข้องกับฟีเจอร์ใหม่

| สถานการณ์ | UI ที่ควรมี |
|----------|------------|
| บรรลุเป้าหมาย | Celebration Modal + ข้อความให้กำลังใจ + ปุ่มปิด |
| เป้าหมายร่วม | แสดงรายชื่อสมาชิก + ยอดที่แต่ละคนใส่ |
| เชิญคนอื่น | ปุ่ม “เชิญ” → แชร์ลิงก์หรือค้นหาจากรายชื่อ |
| ดูความคืบหน้า | แสดงทั้งยอดรวมและยอดของตัวเอง |

---

## 8. สรุปตารางทั้งหมดของ Goal System

| ตาราง | หน้าที่ |
|------|--------|
| `goals` | ข้อมูลเป้าหมายหลัก (เดี่ยว + ร่วม) |
| `goal_members` | สมาชิกของเป้าหมาย + role + ยอดที่ใส่ |
| `goal_contributions` | ยอด/วันที่แต่ละคนบันทึก |
| `goal_invitations` | คำเชิญ + ข้อความเชิญ + รหัส/ลิงก์ |
| `celebration_messages` | ข้อความแสดงความยินดี (optional) |

### ฟีเจอร์ที่เกี่ยวข้องกับการเชิญ

| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| สร้างคำเชิญ | สร้าง `invite_code` + `invite_link` |
| ข้อความเชิญ | สร้างข้อความอัตโนมัติ + แนบข้อความส่วนตัวได้ |
| ช่องทางส่ง | แชร์ผ่าน Share Sheet (LINE, ข้อความ, อีเมล ฯลฯ) |
| ยอมรับ / ปฏิเสธ | อัปเดตสถานะ + เพิ่มเป็น member |
| หมดอายุ | รองรับ `expires_at` |

---

พร้อมให้ผมทำต่อได้เลยครับ:

1. สร้าง **SQL migration เต็ม ๆ** (ทุกตาราง + Trigger + RLS)
2. ออกแบบหน้าจอ “เชิญคนอื่น” + ข้อความเชิญ
3. อัปเดตเอกสารอื่นให้ครบ
