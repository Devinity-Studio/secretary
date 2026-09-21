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
  toast.error("บันทึกขึ้นคลาวด์ไม่สำเร็จ — ข้อมูลยังอยู่ในเครื่อง และจะลองใหม่เมื่อมีการแก้ไขครั้งถัดไป", {
    id: PUSH_TOAST_ID,
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
