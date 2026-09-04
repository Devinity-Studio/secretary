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
import type { Account, Transaction } from "@/lib/finance/types";
import type { Goal, Contribution } from "@/lib/goals/types";
import type { CalendarEvent } from "@/lib/calendar/types";

// ── Table name constants ─────────────────────────────────────
const TABLES = {
  accounts: "accounts",
  transactions: "transactions",
  goals: "goals",
  contributions: "contributions",
  calendarEvents: "calendar_events",
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
}

export async function pullAll(): Promise<SyncData | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = getSupabase();

  const [accountsRes, txRes, goalsRes, contribRes, eventsRes] = await Promise.all([
    supabase.from(TABLES.accounts).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.transactions).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.goals).select("*").eq("user_id", userId).is("deleted_at", null),
    supabase.from(TABLES.contributions).select("*").eq("user_id", userId),
    supabase.from(TABLES.calendarEvents).select("*").eq("user_id", userId).is("deleted_at", null),
  ]);

  return {
    accounts: (accountsRes.data ?? []).map(rowToAccount),
    transactions: (txRes.data ?? []).map(rowToTx),
    goals: (goalsRes.data ?? []).map(rowToGoal),
    contributions: (contribRes.data ?? []).map(rowToContrib),
    events: (eventsRes.data ?? []).map(rowToEvent),
  };
}

// ── PUSH: Write individual rows (fire-and-forget) ───────────

async function upsertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const supabase = getSupabase();
  await supabase.from(table).upsert(row, { onConflict: "id" });
}

async function deleteRow(table: string, id: string): Promise<void> {
  const supabase = getSupabase();
  // Soft delete
  await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

async function hardDeleteRow(table: string, id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from(table).delete().eq("id", id);
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

// ── Bulk push (for initial sync after login) ─────────────────

export async function pushAllLocal(data: SyncData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const supabase = getSupabase();

  // Upsert all local rows to Supabase
  if (data.accounts.length > 0) {
    await supabase.from(TABLES.accounts).upsert(
      data.accounts.map((a) => accountToRow(a, userId)),
      { onConflict: "id" },
    );
  }
  if (data.transactions.length > 0) {
    await supabase.from(TABLES.transactions).upsert(
      data.transactions.map((t) => txToRow(t, userId)),
      { onConflict: "id" },
    );
  }
  if (data.goals.length > 0) {
    await supabase.from(TABLES.goals).upsert(
      data.goals.map((g) => goalToRow(g, userId)),
      { onConflict: "id" },
    );
  }
  if (data.contributions.length > 0) {
    await supabase.from(TABLES.contributions).upsert(
      data.contributions.map((c) => contribToRow(c, userId)),
      { onConflict: "id" },
    );
  }
  if (data.events.length > 0) {
    await supabase.from(TABLES.calendarEvents).upsert(
      data.events.map((e) => eventToRow(e, userId)),
      { onConflict: "id" },
    );
  }
}
