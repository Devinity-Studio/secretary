/**
 * Supabase sync service — browser-side.
 *
 * Architecture:
 *   - RLS scopes every query to auth.uid(), so the browser client is safe.
 *   - On login: pullAll() hydrates local stores from Supabase.
 *   - After each local mutation: pushRow() writes to Supabase in the background.
 *   - localStorage remains the source of truth for reads (instant, offline-safe).
 *   - Supabase is the durable backup (survives device switch, clearing storage).
 */
import { getSupabase } from "./client";
import { enqueueOutbox, removeFromOutbox, scheduleOutboxFlush } from "./outbox";
import { notifyPullFailure } from "./sync-status";
import type { Account, Transaction } from "@/lib/finance/types";
import type { Goal, Contribution } from "@/lib/goals/types";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { Evidence, SecretaryContext } from "@/lib/context/types";

// ── Table name constants ─────────────────────────────────────
const TABLES = {
  accounts: "accounts",
  transactions: "transactions",
  goals: "goals",
  contributions: "contributions",
  calendarEvents: "calendar_events",
  contexts: "contexts",
  contextEvidence: "context_evidence",
} as const;

// ── Row mappers (camelCase ↔ snake_case) ────────────────────

function accountToRow(a: Account, userId: string) {
  return {
    id: a.id,
    user_id: userId,
    name: a.name,
    type: a.type,
    current_balance: a.currentBalance,
    credit_limit: a.creditLimit ?? null,
    color: a.color,
    archived: a.archived,
    created_at: a.createdAt,
    updated_at: a.createdAt, // Account type lacks updatedAt; use createdAt
  };
}

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Account["type"],
    currentBalance: Number(r.current_balance),
    creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
    color: r.color as string,
    archived: r.archived as boolean,
    createdAt: r.created_at as string,
  };
}

function txToRow(t: Transaction, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    type: t.type,
    title: t.title,
    amount: t.amount,
    account_id: t.accountId,
    to_account_id: t.toAccountId ?? null,
    category: t.category,
    date: t.date,
    note: t.note ?? null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function rowToTx(r: Record<string, unknown>): Transaction {
  return {
    id: r.id as string,
    type: r.type as Transaction["type"],
    title: r.title as string,
    amount: Number(r.amount),
    accountId: r.account_id as string,
    toAccountId: r.to_account_id as string | null,
    category: r.category as string,
    date: r.date as string,
    note: r.note as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function goalToRow(g: Goal, userId: string) {
  return {
    id: g.id,
    user_id: userId,
    title: g.title,
    type: g.type,
    target_amount: g.targetAmount,
    unit: g.unit,
    start_date: g.startDate,
    end_date: g.endDate,
    status: g.status,
    note: g.note ?? null,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
  };
}

function rowToGoal(r: Record<string, unknown>): Goal {
  return {
    id: r.id as string,
    title: r.title as string,
    type: r.type as Goal["type"],
    targetAmount: Number(r.target_amount),
    unit: r.unit as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    status: r.status as Goal["status"],
    note: r.note as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function contribToRow(c: Contribution, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    goal_id: c.goalId,
    amount: c.amount,
    date: c.date,
    note: c.note ?? null,
    created_at: c.createdAt,
  };
}

function rowToContrib(r: Record<string, unknown>): Contribution {
  return {
    id: r.id as string,
    goalId: r.goal_id as string,
    amount: Number(r.amount),
    date: r.date as string,
    note: r.note as string | null,
    createdAt: r.created_at as string,
  };
}

function eventToRow(e: CalendarEvent, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    type: e.type,
    title: e.title,
    date: e.date,
    start_time: e.startTime ?? null,
    end_time: e.endTime ?? null,
    all_day: e.allDay,
    leave_type: e.leaveType ?? null,
    note: e.note ?? null,
    color: e.color,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function rowToEvent(r: Record<string, unknown>): CalendarEvent {
  return {
    id: r.id as string,
    type: r.type as CalendarEvent["type"],
    title: r.title as string,
    date: r.date as string,
    startTime: r.start_time as string | null,
    endTime: r.end_time as string | null,
    allDay: r.all_day as boolean,
    leaveType: r.leave_type as CalendarEvent["leaveType"],
    note: r.note as string | null,
    color: r.color as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ── Context mappers (camelCase ↔ snake_case) ────────────────
//
// Context rows are stored with jsonb columns for nested domain structures
// (facts, inferences, links, history, …) — the client is the domain authority.
// `updated_at` is the CLIENT timestamp (no server trigger) and is the
// last-write-wins arbitration key for conflict resolution on merge.

// Mappers are exported for sync unit tests (pure functions — no client access).

export function contextToRow(c: SecretaryContext, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    type: c.type,
    lifecycle: c.lifecycle,
    evidence_ids: c.evidenceIds,
    facts: c.facts,
    inferences: c.inferences,
    primary_source: c.primarySource,
    sources: c.sources,
    links: c.links,
    related_contexts: c.relatedContexts,
    history: c.history,
    created_by: c.createdBy,
    expires_at: c.expiresAt,
    priority: c.priority,
    tags: c.tags,
    archived: c.archived,
    shared_with_user_ids: c.sharedWithUserIds,
    canonical_id: c.canonicalId,
    deleted_at: c.deletedAt ?? null,
    created_at: c.createdAt,
    // Client-authoritative: arbitration for last-write-wins — NOT server now().
    updated_at: c.updatedAt,
  };
}

export function rowToContext(r: Record<string, unknown>): SecretaryContext {
  return {
    id: r.id as string,
    type: r.type as string,
    lifecycle: r.lifecycle as SecretaryContext["lifecycle"],
    evidenceIds: (r.evidence_ids ?? []) as string[],
    facts: (r.facts ?? []) as SecretaryContext["facts"],
    inferences: (r.inferences ?? []) as SecretaryContext["inferences"],
    primarySource: r.primary_source as SecretaryContext["primarySource"],
    sources: (r.sources ?? []) as SecretaryContext["sources"],
    links: (r.links ?? []) as SecretaryContext["links"],
    relatedContexts: (r.related_contexts ?? []) as SecretaryContext["relatedContexts"],
    history: (r.history ?? []) as SecretaryContext["history"],
    createdBy: r.created_by as SecretaryContext["createdBy"],
    expiresAt: (r.expires_at as string | null) ?? null,
    priority: Number(r.priority),
    tags: (r.tags ?? []) as string[],
    archived: r.archived as boolean,
    sharedWithUserIds: (r.shared_with_user_ids ?? null) as string[] | null,
    canonicalId: (r.canonical_id as string | null) ?? null,
    deletedAt: (r.deleted_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function evidenceToRow(e: Evidence, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    source_type: e.sourceType,
    source_id: e.sourceId,
    content: e.content,
    captured_at: e.capturedAt,
    confidence: e.confidence,
  };
}

export function rowToEvidence(r: Record<string, unknown>): Evidence {
  return {
    id: r.id as string,
    sourceType: r.source_type as Evidence["sourceType"],
    sourceId: (r.source_id as string | null) ?? null,
    content: r.content as Evidence["content"],
    capturedAt: r.captured_at as string,
    confidence: r.confidence as Evidence["confidence"],
  };
}

// ── Helper: get current user id from Supabase session ────────

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── PULL: Hydrate from Supabase ─────────────────────────────

export interface SyncData {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  contributions: Contribution[];
  events: CalendarEvent[];
  contexts: SecretaryContext[];
  contextEvidence: Evidence[];
}

export async function pullAll(): Promise<SyncData | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = getSupabase();

  const [accountsRes, txRes, goalsRes, contribRes, eventsRes, contextsRes, evidenceRes] = await Promise.all([
    supabase.from(TABLES.accounts).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.transactions).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.goals).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.contributions).select("*").eq("user_id", userId),
    supabase.from(TABLES.calendarEvents).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.contexts).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.contextEvidence).select("*").eq("user_id", userId),
  ]);

  // A failed query must never masquerade as "remote is empty" — that used to
  // turn schema/RLS/network problems into a silent full local→cloud overwrite
  // on first login. Report it and let the caller bail on the null result.
  const firstError = [accountsRes, txRes, goalsRes, contribRes, eventsRes, contextsRes, evidenceRes].find((r) => r.error)?.error;
  if (firstError) {
    notifyPullFailure(firstError.message);
    return null;
  }

  return {
    accounts: (accountsRes.data ?? []).map(rowToAccount),
    transactions: (txRes.data ?? []).map(rowToTx),
    goals: (goalsRes.data ?? []).map(rowToGoal),
    contributions: (contribRes.data ?? []).map(rowToContrib),
    events: (eventsRes.data ?? []).map(rowToEvent),
    contexts: (contextsRes.data ?? []).map(rowToContext),
    contextEvidence: (evidenceRes.data ?? []).map(rowToEvidence),
  };
}

// ── PUSH: Write individual rows (fire-and-forget) ───────────

// supabase-js reports REST failures (RLS denial, missing table, network 4xx)
// as a RETURNED error, not a throw — so every push helper must check `error`
// and throw it, or failures vanish silently and notifyPushFailure never fires.

/**
 * Upsert rows with a chunked fallback.
 *
 * Why: a batch upsert fails atomically on PostgREST — one bad row (e.g. a
 * legacy row carrying a value that violates a current constraint) sinks the
 * WHOLE batch. If the first attempt fails, retry in chunks and drop chunks
 * that still fail so the healthy majority still lands.
 */
async function upsertWithFallback(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ error: unknown | null }> {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (!error) return { error: null };

  if (rows.length === 1) return { error }; // single row — nothing to degrade
  console.error(`[sync] batch upsert to ${table} failed (${rows.length} rows), retrying in chunks:`, error);

  const CHUNK = 25;
  let lastError: unknown = error;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: chunkError } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (chunkError) {
      console.error(`[sync] chunk ${i}-${i + chunk.length} of ${table} failed, dropping those rows:`, chunkError);
      lastError = chunkError;
    }
  }
  return { error: lastError };
}

async function upsertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const supabase = getSupabase();
  const { error } = await supabase.from(table).upsert(row, { onConflict: "id" });
  if (error) {
    // Durable retry: queue the row so it lands when connectivity returns.
    enqueueOutbox({ id: row.id as string, table, op: "upsert", row });
    throw error;
  }
  removeFromOutbox(table, row.id as string);
  scheduleOutboxFlush();
}

async function deleteRow(table: string, id: string): Promise<void> {
  const supabase = getSupabase();
  // Soft delete
  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: deletedAt })
    .eq("id", id);
  if (error) {
    enqueueOutbox({ id, table, op: "soft-delete", row: { id }, deletedAt });
    throw error;
  }
  removeFromOutbox(table, id);
  scheduleOutboxFlush();
}

async function hardDeleteRow(table: string, id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    enqueueOutbox({ id, table, op: "hard-delete", row: { id } });
    throw error;
  }
  removeFromOutbox(table, id);
  scheduleOutboxFlush();
}

// ── Public push helpers (fire-and-forget, called after local mutations) ──

export async function pushAccount(a: Account): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.accounts, accountToRow(a, userId));
}

export async function pushTransaction(t: Transaction): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.transactions, txToRow(t, userId));
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteRow(TABLES.transactions, id);
}

export async function pushGoal(g: Goal): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.goals, goalToRow(g, userId));
}

export async function deleteGoal(id: string): Promise<void> {
  // Also delete contributions
  const supabase = getSupabase();
  const { data } = await supabase.from(TABLES.contributions).select("id").eq("goal_id", id);
  if (data) {
    for (const c of data) {
      await hardDeleteRow(TABLES.contributions, c.id);
    }
  }
  await deleteRow(TABLES.goals, id);
}

export async function pushContribution(c: Contribution): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.contributions, contribToRow(c, userId));
}

export async function deleteContribution(id: string): Promise<void> {
  await hardDeleteRow(TABLES.contributions, id);
}

export async function pushEvent(e: CalendarEvent): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.calendarEvents, eventToRow(e, userId));
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteRow(TABLES.calendarEvents, id);
}

// ── Context push (fire-and-forget, called after local mutations) ──
//
// Evidence rows are IMMUTABLE by domain law — they are inserted once and
// never updated. Upsert makes the write idempotent (a retried push or a
// second device pushing the same evidence row is a no-op), so `onConflict:
// "id"` with identical payloads is safe here by design.

export async function pushContext(c: SecretaryContext): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.contexts, contextToRow(c, userId));
}

export async function pushContextEvidence(e: Evidence): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await upsertRow(TABLES.contextEvidence, evidenceToRow(e, userId));
}

export async function deleteContext(id: string): Promise<void> {
  await deleteRow(TABLES.contexts, id);
}

/**
 * Merge pull + local context stores under last-write-wins (LWW) on `updatedAt`.
 *
 * Used by useSyncOnLogin: a device that was offline edits rows whose
 * `updatedAt` is NEWER than the pulled rows — those local wins get pushed back
 * after the merge so the newest state converges on every device. Local rows
 * missing remotely are new (or were soft-deleted elsewhere); new ones are
 * pushed, and evidence follows its context when the context wins.
 */
export function mergeContexts(
  local: { contexts: Record<string, SecretaryContext>; evidence: Record<string, Evidence> },
  remoteContexts: SecretaryContext[],
  remoteEvidence: Evidence[],
): { contexts: Record<string, SecretaryContext>; evidence: Record<string, Evidence>; toPush: SecretaryContext[]; evidenceToPush: Evidence[] } {
  const contexts: Record<string, SecretaryContext> = { ...local.contexts };
  const evidence: Record<string, Evidence> = { ...local.evidence };
  const toPush: SecretaryContext[] = [];
  const evidenceToPush: Evidence[] = [];

  const remoteEvById = new Map(remoteEvidence.map((e) => [e.id, e]));

  for (const rc of remoteContexts) {
    const lc = local.contexts[rc.id];
    if (!lc) {
      // Remote-only → take it, and take any evidence we don't have yet.
      contexts[rc.id] = rc;
      for (const eid of rc.evidenceIds) {
        const re = remoteEvById.get(eid);
        if (re && !evidence[eid]) {
          evidence[eid] = re;
        }
      }
      continue;
    }
    // Both sides → last-write-wins on updatedAt.
    const winner = rc.updatedAt > lc.updatedAt ? rc : lc;
    contexts[rc.id] = winner;
    if (winner === rc) {
      // Remote won → adopt its evidence set (immutable rows, safe to copy).
      for (const eid of rc.evidenceIds) {
        const re = remoteEvById.get(eid);
        if (re) evidence[eid] = re;
      }
    } else {
      // Local won → push it back so other devices converge.
      toPush.push(lc);
      for (const eid of lc.evidenceIds) {
        const re = remoteEvById.get(eid);
        if (re && !evidence[eid]) evidence[eid] = re;
      }
    }
  }

  // Local-only rows: brand-new on this device → push them (with evidence).
  const remoteIds = new Set(remoteContexts.map((c) => c.id));
  for (const lc of Object.values(local.contexts)) {
    if (!remoteIds.has(lc.id)) {
      toPush.push(lc);
      for (const eid of lc.evidenceIds) {
        const le = local.evidence[eid];
        if (le) evidenceToPush.push(le);
      }
    }
  }

  return { contexts, evidence, toPush, evidenceToPush };
}

// ── Bulk push (for initial sync after login) ─────────────────

export async function pushAllLocal(data: SyncData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const supabase = getSupabase();

  // Upsert all local rows to Supabase.
  //
  // A table whose upload fails (schema drift, legacy rows violating current
  // constraints, …) must NOT abort the remaining tables — everything that can
  // sync should sync. Collect failures and throw at the end so callers still
  // surface one aggregated push failure.
  const failures: unknown[] = [];
  const upsertAll = async (table: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const { error } = await upsertWithFallback(supabase, table, rows);
    if (error) {
      console.error(`[sync] pushAllLocal: ${table} failed:`, error);
      failures.push(error);
    }
  };

  await upsertAll(TABLES.accounts, data.accounts.map((a) => accountToRow(a, userId)));
  await upsertAll(TABLES.transactions, data.transactions.map((t) => txToRow(t, userId)));
  await upsertAll(TABLES.goals, data.goals.map((g) => goalToRow(g, userId)));
  await upsertAll(TABLES.contributions, data.contributions.map((c) => contribToRow(c, userId)));
  await upsertAll(TABLES.calendarEvents, data.events.map((e) => eventToRow(e, userId)));
  await upsertAll(TABLES.contexts, data.contexts.map((c) => contextToRow(c, userId)));
  await upsertAll(TABLES.contextEvidence, data.contextEvidence.map((e) => evidenceToRow(e, userId)));

  if (failures.length > 0) {
    throw failures[0];
  }
}
