-- ============================================================
-- คุณเลขา — Context Realtime (ขั้น: publication)
-- ============================================================
-- Realtime bridge ในแอป (src/lib/supabase/realtime.ts) ใช้ postgres_changes
-- บนตาราง contexts / context_evidence — ซึ่งทำงานได้เมื่อทั้งสองตารางอยู่ใน
-- publication `supabase_realtime` เท่านั้น ไม่งั้น subscribe สำเร็จแต่ event
-- ไม่เคยมา (เช็คสถานะได้ด้วย getRealtimeStatus())
--
-- RLS ยังครอบคลุมทุก event เหมือนเดิม: Postgres Realtime ส่ง event ให้
-- session ใดก็ตามที่ RLS อนุญาต (เจ้าของแถวเท่านั้น) — ไม่มีข้อมูลข้าม user
--
-- Idempotent: รันซ้ำได้ปลอดภัย (drop publication if exists ก่อนสร้างใหม่)
-- ============================================================

drop publication if exists supabase_realtime;

create publication supabase_realtime;

alter publication supabase_realtime add table contexts;
alter publication supabase_realtime add table context_evidence;
