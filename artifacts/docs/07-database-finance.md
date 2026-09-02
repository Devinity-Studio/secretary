# Database Design — Finance & Accounts System

> ระบบบัญชีการเงินแบบต่อเนื่อง (ไม่มีกำหนดเวลา)  
> รองรับหลายบัญชี • โอนข้ามบัญชี • บัญชีร่วม • รายงานตามต้องการ

---

## 1. แนวคิดหลัก

| ความต้องการ | วิธีรองรับ |
|------------|-----------|
| หลายบัญชี | ตาราง `accounts` |
| โอนข้ามบัญชี | รายการประเภท `transfer` สร้าง 2 leg (ออก + เข้า) |
| บัญชีร่วม (ครอบครัว) | ตาราง `account_members` |
| ออมสะสมไปเรื่อย ๆ | บัญชีประเภท `savings` ไม่มี end_date |
| รายรับ / รายจ่าย | รายการประเภท `income` / `expense` |
| รายงานตามต้องการ | Query จาก `transactions` ตามช่วงวันที่ / บัญชี / ประเภท |

**หลักการสำคัญ:** ใช้แนวคิด **Double-entry อย่างง่าย**
- โอนเงินจากบัญชี A → B  
  = สร้างรายการออกจาก A + รายการเข้า B ใน transaction เดียวกัน

---

## 2. ความแตกต่างจาก Goal System

| หัวข้อ | Goal System | Finance / Accounts |
|--------|-------------|---------------------|
| มีกำหนดเวลา | มี start_date / end_date | ไม่มี (ต่อเนื่อง) |
| เป้าหมายตัวเลข | มี target_value | ไม่บังคับ (มีได้แบบ optional) |
| การวัดผล | ถึงเป้าหรือไม่ | ยอดคงเหลือ + ประวัติการเดินบัญชี |
| ผู้ใช้ร่วม | ผ่าน goal_members | ผ่าน account_members |
| รายงาน | ความคืบหน้าเป้าหมาย | รายการเดินบัญชี, สรุปรายรับ-รายจ่าย, ยอดคงเหลือ |

ทั้งสองระบบสามารถทำงานร่วมกันได้  
เช่น โอนเข้าบัญชีออม → อัปเดตทั้งยอดบัญชี และ contribution ของ Goal (ถ้าผูกไว้)

---

## 3. ตารางหลัก

### 3.1 `accounts` (บัญชี)

```sql
CREATE TABLE accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,                     -- เช่น "บัญชีส่วนตัว", "สะสมครอบครัว"
  account_type      TEXT NOT NULL DEFAULT 'cash',
  -- cash | bank | credit | savings | ewallet | investment | other

  is_shared         BOOLEAN NOT NULL DEFAULT false,    -- บัญชีร่วมหรือไม่
  currency          TEXT NOT NULL DEFAULT 'THB',

  -- ยอดคงเหลือ (cache เพื่อแสดงเร็ว)
  -- หมายเหตุ: บัตรเครดิตเก็บเป็นยอดที่ใช้ไป (บวก = เป็นหนี้)
  current_balance   NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- สำหรับบัตรเครดิต
  credit_limit      NUMERIC(15,2),                     -- วงเงินบัตร
  billing_day       INTEGER,                           -- วันตัดบัตร (1-31)
  payment_due_day   INTEGER,                           -- วันครบกำหนดจ่าย

  -- เป้าหมายออมแบบไม่บังคับ (ไม่มีกำหนดเวลา)
  target_balance    NUMERIC(15,2),                     -- เช่น อยากให้มียอด 100,000
  color             TEXT DEFAULT '#10B981',
  icon              TEXT,
  sort_order        INTEGER DEFAULT 0,
  is_archived       BOOLEAN NOT NULL DEFAULT false,

  metadata          JSONB DEFAULT '{}',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
```

### ประเภทบัญชีที่รองรับ (สำคัญ)

| account_type | ชื่อที่แสดง | ลักษณะ | ตัวอย่าง |
|--------------|------------|--------|---------|
| `cash` | เงินสด | เงินในกระเป๋า | เงินสดติดตัว |
| `bank` | บัญชีธนาคาร | บัญชีออมทรัพย์/กระแสรายวัน | กสิกร, ไทยพาณิชย์, กรุงไทย |
| `credit` | บัตรเครดิต | ยอดใช้ไป = หนี้ | บัตรเครดิตกสิกร, บัตรกลาง |
| `savings` | บัญชีออม/สะสม | ออมระยะยาว หรือบัญชีครอบครัว | สะสมครอบครัว, ออมบ้าน |
| `ewallet` | e-Wallet | กระเป๋าเงินดิจิทัล | TrueMoney, LINE Pay, PromptPay |
| `investment` | การลงทุน | กองทุน, หุ้น (ขยายทีหลัง) | - |
| `other` | อื่น ๆ | ใช้ตามต้องการ | - |

**ตัวอย่างการใช้งานจริงของผู้ใช้คนหนึ่ง:**
- เงินสด (cash)
- บัญชีกสิกรส่วนตัว (bank)
- บัญชีไทยพาณิชย์ (bank)
- บัตรเครดิตกสิกร (credit)
- TrueMoney (ewallet)
- สะสมครอบครัว (savings, is_shared = true)

**พฤติกรรมพิเศษของบัตรเครดิต:**
- `current_balance` = ยอดที่ใช้ไปแล้ว (ยิ่งมาก = เป็นหนี้มากขึ้น)
- มี `credit_limit` สำหรับคำนวณยอดใช้ได้เหลือ
- รายการใช้บัตร = `expense` ที่ผูกกับบัญชี credit
- จ่ายบิลบัตร = `transfer` จากบัญชีธนาคาร → บัญชีบัตรเครดิต (ลดยอดหนี้)

---

### 3.2 `account_members` (สมาชิกบัญชีร่วม)

```sql
CREATE TABLE account_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role              TEXT NOT NULL DEFAULT 'member',    -- owner | member | viewer
  status            TEXT NOT NULL DEFAULT 'active',    -- active | invited | left | removed

  -- สิทธิ์
  can_add_transaction BOOLEAN NOT NULL DEFAULT true,
  can_transfer        BOOLEAN NOT NULL DEFAULT true,
  can_invite          BOOLEAN NOT NULL DEFAULT false,

  invited_by        UUID REFERENCES auth.users(id),
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (account_id, user_id)
);
```

**Role แนะนำ:**
- `owner` — จัดการทุกอย่าง + ลบบัญชีได้
- `member` — เพิ่มรายการ / โอนได้
- `viewer` — ดูอย่างเดียว

---

### 3.3 `transactions` (รายการเดินบัญชี)

```sql
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id),  -- คนที่บันทึก

  -- ประเภทหลัก
  type                TEXT NOT NULL,
  -- income | expense | transfer

  title               TEXT NOT NULL,
  note                TEXT,
  amount              NUMERIC(15,2) NOT NULL,          -- จำนวนเงิน (บวกเสมอ)
  currency            TEXT NOT NULL DEFAULT 'THB',

  -- บัญชีที่เกี่ยวข้อง
  account_id          UUID NOT NULL REFERENCES accounts(id),     -- บัญชีหลักของรายการนี้
  transfer_account_id UUID REFERENCES accounts(id),              -- บัญชีคู่กรณี (กรณี transfer)

  -- สำหรับจัดกลุ่มรายการโอน (ให้ 2 ฝั่งอยู่ด้วยกัน)
  transfer_group_id   UUID,                            -- UUID เดียวกันสำหรับขาออก + ขาเข้า

  category            TEXT,                            -- อาหาร, เดินทาง, เงินเดือน ฯลฯ
  transaction_date    DATE NOT NULL DEFAULT CURRENT_DATE,

  -- ลิงก์กับระบบอื่น (optional)
  goal_id             UUID,                            -- ถ้าผูกกับเป้าหมาย
  linked_record_id    UUID,

  metadata            JSONB DEFAULT '{}',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
```

**วิธีบันทึกการโอน (สำคัญมาก):**

เมื่อโอนจาก “บัญชีส่วนตัว” → “สะสมครอบครัว” จำนวน 1,000 บาท  
ระบบสร้าง **2 รายการ** ภายใต้ `transfer_group_id` เดียวกัน:

| รายการ | account_id | transfer_account_id | type | amount | ผลต่อยอด |
|--------|------------|---------------------|------|--------|----------|
| ขาออก | บัญชีส่วนตัว | สะสมครอบครัว | transfer | 1000 | ลดยอดบัญชีส่วนตัว |
| ขาเข้า | สะสมครอบครัว | บัญชีส่วนตัว | transfer | 1000 | เพิ่มยอดสะสมครอบครัว |

หรือจะเก็บเป็นรายการเดียวแล้วคำนวณตอนแสดงก็ได้  
แต่แนะนำแบบ 2 leg เพื่อให้แต่ละบัญชีมีประวัติเดินบัญชีครบ

---

### 3.4 `account_invitations` (เชิญเข้าบัญชีร่วม)

ใช้แนวเดียวกับ `goal_invitations`

```sql
CREATE TABLE account_invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  inviter_id        UUID NOT NULL REFERENCES auth.users(id),

  invitee_user_id   UUID REFERENCES auth.users(id),
  invitee_email     TEXT,
  invitee_phone     TEXT,
  invitee_name      TEXT,

  message           TEXT,
  invite_code       TEXT UNIQUE NOT NULL,
  invite_link       TEXT,

  role              TEXT NOT NULL DEFAULT 'member',    -- สิทธิ์ที่จะได้เมื่อยอมรับ
  status            TEXT NOT NULL DEFAULT 'pending',
  -- pending | accepted | declined | expired | cancelled

  expires_at        TIMESTAMPTZ,
  responded_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. ตรรกะการคำนวณยอดคงเหลือ

### 4.1 อัปเดต `current_balance` ของบัญชี

```text
รายรับ (income)          → balance += amount
รายจ่าย (expense)        → balance -= amount
โอนออก (transfer out)    → balance -= amount
โอนเข้า (transfer in)    → balance += amount
```

แนะนำให้ใช้ **Trigger** หรือ Function อัปเดตทุกครั้งที่มีการ insert/update/delete transaction

### 4.2 ตัวอย่าง Function คร่าว ๆ

```sql
-- เมื่อมี transaction ใหม่
IF type = 'income' THEN
  UPDATE accounts SET current_balance = current_balance + amount WHERE id = account_id;
ELSIF type = 'expense' THEN
  UPDATE accounts SET current_balance = current_balance - amount WHERE id = account_id;
ELSIF type = 'transfer' THEN
  -- ขึ้นกับว่าเป็นขาออกหรือขาเข้า (ดูจาก transfer_group หรือทิศทาง)
  ...
END IF;
```

---

## 5. ตัวอย่างสถานการณ์จริง

### สถานการณ์: ผมโอนเงิน 2,000 บาท จากบัญชีส่วนตัว → สะสมครอบครัว

1. สร้าง `transfer_group_id` = `tg-001`
2. สร้างรายการที่ 1 (ขาออก)
   - account_id = บัญชีส่วนตัว
   - transfer_account_id = สะสมครอบครัว
   - amount = 2000
   - type = transfer
3. สร้างรายการที่ 2 (ขาเข้า)
   - account_id = สะสมครอบครัว
   - transfer_account_id = บัญชีส่วนตัว
   - amount = 2000
   - type = transfer
4. อัปเดตยอด:
   - บัญชีส่วนตัว -= 2000
   - สะสมครอบครัว += 2000
5. ทั้ง 2 บัญชีมีประวัติเดินบัญชีครบ

### สถานการณ์: แฟนดูบัญชีสะสมครอบครัว
- เป็น `account_members` role = member
- เห็นยอดคงเหลือ + รายการทั้งหมดของบัญชีนี้
- สามารถเพิ่มรายการได้ (ตามสิทธิ์)

---

## 6. รายงานและการเรียกดูตามช่วงเวลา

ระบบรองรับการเรียกดูและสรุปผลได้ 4 ระดับหลัก:

| ระดับ | ตัวอย่างการใช้งาน |
|------|------------------|
| **รายวัน** | ดูรายการวันนี้ / เลือกวันใดวันหนึ่ง |
| **รายสัปดาห์** | สรุปสัปดาห์นี้ / สัปดาห์ที่แล้ว |
| **รายเดือน** | สรุปเดือนปัจจุบัน / เลือกเดือน |
| **รายปี** | สรุปทั้งปี / เปรียบเทียบปี |

### 6.1 วิธีได้มาจากฐานข้อมูล

เพราะเก็บ `transaction_date` เป็น DATE อยู่แล้ว → filter ตามช่วงได้ทันที

```sql
-- รายวัน
WHERE transaction_date = '2026-09-02'

-- รายสัปดาห์ (เช่น จันทร์-อาทิตย์)
WHERE transaction_date BETWEEN '2026-09-01' AND '2026-09-07'

-- รายเดือน
WHERE transaction_date >= '2026-09-01' 
  AND transaction_date < '2026-10-01'

-- รายปี
WHERE transaction_date >= '2026-01-01' 
  AND transaction_date < '2027-01-01'
```

### 6.2 รายงานที่รองรับตามช่วงเวลา

| รายงาน | รายวัน | รายสัปดาห์ | รายเดือน | รายปี |
|--------|:------:|:----------:|:--------:|:-----:|
| รายการเดินบัญชี | ✅ | ✅ | ✅ | ✅ |
| สรุปรายรับรวม | ✅ | ✅ | ✅ | ✅ |
| สรุปรายจ่ายรวม | ✅ | ✅ | ✅ | ✅ |
| สุทธิ (รายรับ − รายจ่าย) | ✅ | ✅ | ✅ | ✅ |
| ยอดโอนเข้า / โอนออก | ✅ | ✅ | ✅ | ✅ |
| สัดส่วนตามหมวดหมู่ | ✅ | ✅ | ✅ | ✅ |
| เปรียบเทียบกับช่วงก่อนหน้า | - | ✅ | ✅ | ✅ |
| ยอดคงเหลือ ณ สิ้นช่วง | ✅ | ✅ | ✅ | ✅ |

### 6.3 ตัวอย่าง Query สรุปรายเดือน

```sql
SELECT 
  type,
  category,
  SUM(amount) AS total,
  COUNT(*) AS count
FROM transactions
WHERE account_id = $1
  AND transaction_date >= $2          -- ต้นเดือน
  AND transaction_date < $3           -- ต้นเดือนถัดไป
  AND deleted_at IS NULL
GROUP BY type, category
ORDER BY type, total DESC;
```

### 6.4 UI ที่แนะนำ

- มีตัวเลือกช่วงเวลาชัดเจน:  
  `วันนี้ | สัปดาห์นี้ | เดือนนี้ | ปีนี้ | กำหนดเอง`
- สรุปตัวเลขด้านบน (รายรับ / รายจ่าย / สุทธิ)
- รายการด้านล่างตามช่วงที่เลือก
- สามารถเลือกดูเฉพาะบัญชี หรือดูทุกบัญชีรวมกันได้
- สลับระหว่างมุมมองรายการ กับ มุมมองสรุปได้ง่าย

---

## 7. การเชื่อมกับ Goal System (optional)

```text
ผู้ใช้โอนเงินเข้าบัญชีออม
    ↓
ระบบถามว่า “ต้องการนับเข้าเป้าหมายด้วยไหม?”
    ↓
ถ้าใช่ → สร้าง goal_contribution ให้อัตโนมัติ
```

เก็บ `goal_id` ไว้ใน `transactions` เพื่อเชื่อมโยง

---

## 8. RLS แนวทาง

```sql
-- เห็นบัญชีได้ถ้าเป็น owner หรือเป็น member
CREATE POLICY "View own or shared accounts"
ON accounts FOR SELECT
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = accounts.id
      AND am.user_id = auth.uid()
      AND am.status = 'active'
  )
);

-- เพิ่มรายการได้ถ้ามีสิทธิ์
CREATE POLICY "Members can add transactions"
ON transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM account_members am
    WHERE am.account_id = transactions.account_id
      AND am.user_id = auth.uid()
      AND am.status = 'active'
      AND am.can_add_transaction = true
  )
  OR auth.uid() = (SELECT owner_id FROM accounts WHERE id = transactions.account_id)
);
```

---

## 9. สรุปตาราง Finance System

| ตาราง | หน้าที่ |
|------|--------|
| `accounts` | บัญชีเงินทุกประเภท |
| `account_members` | สมาชิกบัญชีร่วม + สิทธิ์ |
| `transactions` | รายการเดินบัญชีทั้งหมด |
| `account_invitations` | คำเชิญเข้าบัญชีร่วม |

---

## 10. จุดเด่นของออกแบบนี้

- รองรับบัญชีส่วนตัว + บัญชีครอบครัวในระบบเดียวกัน
- โอนข้ามบัญชีแล้วมีประวัติครบทั้ง 2 ฝั่ง
- ออมสะสมได้เรื่อย ๆ ไม่มีวันหมดอายุ
- สร้างรายงานได้ยืดหยุ่นตามช่วงเวลาที่ต้องการ
- เชิญคนอื่นเข้าบัญชีร่วมได้เหมือน Goal
- เชื่อมกับ Goal ได้ถ้าต้องการ

---

พร้อมให้ผมทำต่อได้เลยครับ:

1. สร้าง SQL migration รวม Finance + Goal
2. อัปเดต Design / MVP ให้รวมระบบบัญชีนี้
3. ออกแบบหน้าจอ “รายการเดินบัญชี” + “โอนเงิน”
