/**
 * Sync hardening: user-visible failure reporting.
 *
 * Store mutations push to Supabase fire-and-forget. Until now failures were
 * swallowed with `.catch(() => {})`, so a broken or absent backend silently
 * dropped data on the floor. These helpers surface push/pull failures as a
 * throttled sonner toast — one nag per cooldown window, not one per keystroke.
 *
 * The first-login overwrite guard lives in sync.ts: a failed pull returns
 * null instead of "empty", and use-sync-on-login already bails on null.
 */
import { toast } from "sonner";

const PUSH_TOAST_COOLDOWN_MS = 60_000;
const PUSH_TOAST_ID = "sync-push-failure";

let lastPushToastAt = 0;

/** One throttled toast per cooldown window for background push failures. */
export function notifyPushFailure(error: unknown): void {
  const now = Date.now();
  if (now - lastPushToastAt < PUSH_TOAST_COOLDOWN_MS) return;
  lastPushToastAt = now;
  console.error("[sync] push failed:", error);
  toast.error("บันทึกขึ้นคลาวด์ไม่สำเร็จ — ข้อมูลยังอยู่ในเครื่อง และจะส่งใหม่อัตโนมัติเมื่อออนไลน์กลับมา", {
    id: PUSH_TOAST_ID,
  });
}

const OUTBOX_FLUSHED_TOAST_COOLDOWN_MS = 60_000;
const OUTBOX_FLUSHED_TOAST_ID = "sync-outbox-flushed";
let lastFlushedToastAt = 0;

/** Toast when queued offline pushes finally land (throttled). */
export function notifyOutboxFlushed(count: number): void {
  if (count <= 0) return;
  const now = Date.now();
  if (now - lastFlushedToastAt < OUTBOX_FLUSHED_TOAST_COOLDOWN_MS) return;
  lastFlushedToastAt = now;
  toast.success(`ส่งข้อมูลที่ค้างจากออฟไลน์ขึ้นคลาวด์แล้ว (${count} รายการ)`);
}

const OUTBOX_DROPPED_TOAST_COOLDOWN_MS = 60_000;
const OUTBOX_DROPPED_TOAST_ID = "sync-outbox-dropped";
let lastDroppedToastAt = 0;

/** Toast when a queued push exhausts its retry budget and is dropped for good. */
export function notifyOutboxDropped(table: string): void {
  const now = Date.now();
  if (now - lastDroppedToastAt < OUTBOX_DROPPED_TOAST_COOLDOWN_MS) return;
  lastDroppedToastAt = now;
  console.error("[sync] outbox entry dropped after max attempts:", table);
  toast.error("มีข้อมูลที่ส่งขึ้นคลาวด์ไม่สำเร็จหลายครั้ง — ยังอยู่ในเครื่อง แต่จะไม่ลองส่งรายการนั้นใหม่อีก", {
    id: OUTBOX_DROPPED_TOAST_ID,
  });
}

const PULL_TOAST_COOLDOWN_MS = 60_000;
const PULL_TOAST_ID = "sync-pull-failure";
let lastPullToastAt = 0;

/** One throttled toast per cooldown window for failed full pulls. */
export function notifyPullFailure(reason: string): void {
  const now = Date.now();
  if (now - lastPullToastAt < PULL_TOAST_COOLDOWN_MS) return;
  lastPullToastAt = now;
  console.error("[sync] pull failed:", reason);
  toast.error("ดึงข้อมูลจากคลาวด์ไม่สำเร็จ — ระบบจะไม่นำเข้า/ส่งออกข้อมูลจนกว่าจะเชื่อมต่อสำเร็จ", {
    id: PULL_TOAST_ID,
  });
}
