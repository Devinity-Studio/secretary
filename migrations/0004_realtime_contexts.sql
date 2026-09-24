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
-- ⚠️ ห้ามใช้ `drop publication` กับ Supabase โดยเด็ดขาด:
--   publication `supabase_realtime` เป็นของ Supabase Realtime และบนโปรเจกต์จริง
--   อาจมีตารางอื่น (ชุด 0002 เดิม, ตารางของระบบ auth/storage) เป็นสมาชิกอยู่แล้ว
--   drop แล้ว create ใหม่จะลบสมาชิกทั้งหมดหาย — realtime ของทุกตารางอื่นจะพังเงียบ ๆ
--   ใช้ `alter publication ... add table` แบบ additive เท่านั้น
--
-- Idempotent: รันซ้ำได้ปลอดภัย — ถ้าตารางอยู่ใน publication แล้ว
-- DO block จะข้าม (duplicate_object) และไม่ fail
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.contexts;
exception
  when duplicate_object then null; -- อยู่ใน publication แล้ว — ok
  when undefined_object then
    -- publication ยังไม่มี (โปรเจกต์ Supabase ปกติมีตั้งแต่ provision) — สร้างให้
    create publication supabase_realtime;
    alter publication supabase_realtime add table public.contexts;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.context_evidence;
exception
  when duplicate_object then null; -- อยู่ใน publication แล้ว — ok
end
$$;
