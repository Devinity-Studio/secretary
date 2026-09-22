/**
 * Realtime bridge for Context sync — plain module (no React).
 *
 * Uses postgres_changes (NOT client broadcast) deliberately:
 *   - Every event is RLS-scoped to the owning user by design — no public
 *     broadcast topics, no private-channel authorization setup.
 *   - A soft delete propagates as an UPDATE row carrying deleted_at
 *     (hard DELETE events carry only ids — handled too).
 *   - Requires the tables to be in the `supabase_realtime` publication
 *     (migrations/0004_realtime_contexts.sql). Without it, subscribe still
 *     succeeds but no events arrive — detectable via getRealtimeStatus().
 *
 * Lifecycle: the channel is a singleton bound to one user session. Auth
 * changes (SIGNED_IN / SIGNED_OUT / INITIAL_SESSION) tear it down and
 * re-subscribe so events never cross accounts. Incoming rows go through the
 * store's LWW / immutable-evidence appliers, so our own push echoes and
 * stale broadcasts can never regress local state.
 */
import { getSupabase } from "./client";
import { rowToContext, rowToEvidence } from "./sync";
import { useContextStore } from "@/lib/context/store";

export type RealtimeStatus = "disabled" | "offline" | "subscribed" | "error";

let channel: ReturnType<ReturnType<typeof getSupabase>["channel"]> | null = null;
let boundUserId: string | null = null;
let status: RealtimeStatus = "offline";

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/** Apply one raw contexts row (postgres_changes payload) into the store. */
function applyContextRow(row: Record<string, unknown> | null | undefined): void {
  if (!row || typeof row !== "object") return;
  try {
    useContextStore.getState().applyRemoteContext(rowToContext(row));
  } catch (err) {
    console.error("[realtime] applyContextRow failed:", err);
  }
}

/** Apply one raw context_evidence row (postgres_changes payload). */
function applyEvidenceRow(row: Record<string, unknown> | null | undefined): void {
  if (!row || typeof row !== "object") return;
  try {
    useContextStore.getState().applyRemoteEvidence(rowToEvidence(row));
  } catch (err) {
    console.error("[realtime] applyEvidenceRow failed:", err);
  }
}

/**
 * Bind (or rebind) the realtime channel for the given signed-in user.
 * Idempotent: a call for the same user while already bound is a no-op.
 */
export function bindRealtimeChannel(userId: string): void {
  if (typeof window === "undefined") return;
  if (channel && boundUserId === userId) return;
  unbindRealtimeChannel();

  const supabase = getSupabase();
  // postgres_changes needs no "private" channel config — RLS filters every
  // event to the owning user's session (Realtime RLS), which is the whole
  // security story here.
  const next = supabase
    .channel(`contexts-user-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "contexts", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        // DELETE payloads carry only the old row's id — synthesize a
        // tombstone so the store drops its local copy.
        if (payload.eventType === "DELETE" && row) {
          applyContextRow({ id: row.id, deleted_at: new Date().toISOString() });
          return;
        }
        applyContextRow(row);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "context_evidence", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === "DELETE") return; // evidence rows are never hard-deleted in this app
        applyEvidenceRow(payload.new as Record<string, unknown>);
      },
    )
    .subscribe((state) => {
      status = state === "SUBSCRIBED" ? "subscribed" : state === "CHANNEL_ERROR" ? "error" : "offline";
    });

  channel = next;
  boundUserId = userId;
}

/** Tear down the channel (logout / account switch / unmount safety). */
export function unbindRealtimeChannel(): void {
  if (channel) {
    try {
      getSupabase().removeChannel(channel);
    } catch {
      // channel already gone — nothing to do
    }
  }
  channel = null;
  boundUserId = null;
  status = "offline";
}
