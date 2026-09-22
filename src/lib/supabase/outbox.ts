/**
 * Outbox retry queue — durable retry for failed Supabase pushes.
 *
 * Problem it solves: store mutations push fire-and-forget. When the push
 * fails (offline, table missing, transient 5xx) the local row is safe but the
 * cloud copy stays stale until the user happens to touch that row again.
 *
 * Mechanism:
 *   1. sync.ts catches a failed push → enqueueOutbox({ table, row, op })
 *   2. The queue persists to localStorage (survives reload) and is deduped
 *      latest-wins per (table, id, op) — only the newest payload ever matters
 *      because every write is a full-row upsert or a delete.
 *   3. flushOutbox() replays entries FIFO with a DIRECT Supabase call (it must
 *      not re-enqueue on failure). Success → remove from queue.
 *      Failure → attempts++, kept for the next window; dropped for good after
 *      MAX_OUTBOX_ATTEMPTS (with a user-visible toast).
 *   4. Flush triggers: browser "online" event, tab becomes visible, login /
 *      login-sync completion, and every new enqueue.
 *
 * Everything stays local-first: the queue never blocks a mutation, and a full
 * queue silently drops the OLDEST entry rather than failing new writes.
 */
import { getSupabase } from "./client";
import { notifyOutboxDropped, notifyOutboxFlushed } from "./sync-status";

const OUTBOX_STORAGE_KEY = "secretary-sync-outbox-v1";
const OUTBOX_MAX_ENTRIES = 500;
export const MAX_OUTBOX_ATTEMPTS = 5;

// ── Storage adapter (localStorage ใน browser, memory ตอน SSR/test) ──

const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

let customStorage: Storage | null = null;

function getStorage(): Storage {
  if (customStorage) return customStorage;
  return typeof localStorage === "undefined" ? memoryStorage : localStorage;
}

function loadOutbox(): OutboxEntry[] {
  try {
    const raw = getStorage().getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        !!e && typeof e === "object" && typeof (e as OutboxEntry).id === "string" && typeof (e as OutboxEntry).table === "string",
    );
  } catch {
    return [];
  }
}

function saveOutbox(entries: OutboxEntry[]): void {
  try {
    getStorage().setItem(OUTBOX_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/unavailable — the queue is best-effort by design.
  }
}

export type OutboxOp = "upsert" | "soft-delete" | "hard-delete";

export interface OutboxEntry {
  id: string;
  table: string;
  op: OutboxOp;
  /** Full row payload (upsert) or row id (deletes). */
  row: Record<string, unknown>;
  /** Soft-delete only: the deleted_at timestamp to write. */
  deletedAt?: string;
  enqueuedAt: string;
  attempts: number;
}

// ── Enqueue (latest-wins per table+id+op, FIFO order, capped) ──

export function enqueueOutbox(entry: Omit<OutboxEntry, "enqueuedAt" | "attempts">): void {
  const entries = loadOutbox().filter((e) => !(e.table === entry.table && e.id === entry.id && e.op === entry.op));

  entries.push({
    ...entry,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  });

  // Cap: drop the OLDEST entries — the newest payload is the one that matters.
  while (entries.length > OUTBOX_MAX_ENTRIES) {
    entries.shift();
  }

  saveOutbox(entries);
  void scheduleOutboxFlush();
}

/** A successful push/delete makes every queued op for that row obsolete. */
export function removeFromOutbox(table: string, id: string): void {
  const entries = loadOutbox();
  const next = entries.filter((e) => !(e.table === table && e.id === id));
  if (next.length !== entries.length) saveOutbox(next);
}

// ── Flush ─────────────────────────────────────────────────────

let flushing = false;

/**
 * Replay queued entries against Supabase. Safe to call concurrently —
 * a running flush is never overlapped. Success → remove from queue.
 * Failure → attempts++, kept for the next window; dropped for good after
 * MAX_OUTBOX_ATTEMPTS (with a user-visible toast).
 *
 * `replay` is injectable for unit tests; production uses the direct
 * Supabase call in replayEntry (which must NOT re-enqueue on failure).
 */
export async function flushOutbox(
  replay: (entry: OutboxEntry) => Promise<boolean> = (entry) => replayEntry(entry),
): Promise<void> {
  if (flushing) return;
  flushing = true;
  let flushedCount = 0;
  try {
    for (let guard = 0; guard < OUTBOX_MAX_ENTRIES; guard++) {
      const entries = loadOutbox();
      if (entries.length === 0) break;

      const entry = entries[0];
      // An exception counts as this window's failure — the entry keeps its
      // place and its attempts budget; the flush pass itself must survive.
      let ok: boolean;
      try {
        ok = await replay(entry);
      } catch (err) {
        console.error(`[sync] outbox replay threw for ${entry.table}/${entry.id}:`, err);
        ok = false;
      }

      // Re-read after the await: new entries may have been enqueued meanwhile.
      const remaining = loadOutbox().filter(
        (e) => !(e.table === entry.table && e.id === entry.id && e.op === entry.op),
      );

      if (ok) {
        saveOutbox(remaining);
        flushedCount += 1;
        continue;
      }

      entry.attempts += 1;
      if (entry.attempts >= MAX_OUTBOX_ATTEMPTS) {
        saveOutbox(remaining);
        notifyOutboxDropped(entry.table);
        continue;
      }

      // Still failing — put it back at the head and stop this pass. Retrying
      // the same entry immediately would just burn the same network failure;
      // online/visible/auth events re-arm the flush.
      remaining.unshift(entry);
      saveOutbox(remaining);
      return;
    }
  } finally {
    flushing = false;
  }
  notifyOutboxFlushed(flushedCount);
}

/** One direct Supabase call for a single entry. Never re-enqueues. */
async function replayEntry(entry: OutboxEntry): Promise<boolean> {
  try {
    const supabase = getSupabase();
    let error: unknown = null;

    if (entry.op === "upsert") {
      ({ error } = await supabase.from(entry.table).upsert(entry.row, { onConflict: "id" }));
    } else if (entry.op === "soft-delete") {
      ({ error } = await supabase
        .from(entry.table)
        .update({ deleted_at: entry.deletedAt ?? new Date().toISOString() })
        .eq("id", entry.id));
    } else {
      ({ error } = await supabase.from(entry.table).delete().eq("id", entry.id));
    }

    // supabase-js reports REST failures as a RETURNED error, not a throw.
    if (error) {
      console.error(`[sync] outbox replay failed for ${entry.table}/${entry.id} (${entry.op}):`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[sync] outbox replay threw for ${entry.table}/${entry.id}:`, err);
    return false;
  }
}

// ── Triggers ──────────────────────────────────────────────────

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced flush — coalesces bursts (enqueue → online → visible). */
export function scheduleOutboxFlush(delayMs = 1_000): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushOutbox();
  }, delayMs);
}

let listenersInitialized = false;

/**
 * Install the automatic flush triggers (browser only, idempotent):
 *   - "online" event → connectivity is back
 *   - tab becomes visible → user returned to the app
 *   - supabase login → a session exists to push under
 * (The post-login-sync flush is called explicitly in use-sync-on-login.)
 */
export function initOutboxListeners(): void {
  if (listenersInitialized || typeof window === "undefined") return;
  listenersInitialized = true;

  window.addEventListener("online", () => scheduleOutboxFlush(0));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleOutboxFlush(0);
  });

  void getSupabase().auth.onAuthStateChange((event) => {
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") scheduleOutboxFlush(500);
  });
}

// ── Test hooks (node:test — no Vitest globals, follows project test style) ──

/** Swap the persistence backing store (unit tests use a memory map). */
export function __setOutboxStorageForTests(storage: Storage): void {
  customStorage = storage;
}

/** Empty the queue + reset internal state between tests. */
export function __resetOutboxForTests(): void {
  getStorage().removeItem(OUTBOX_STORAGE_KEY);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushing = false;
}

/** The queue's internal state, for assertions. */
export function __getOutboxForTests(): OutboxEntry[] {
  return loadOutbox();
}
