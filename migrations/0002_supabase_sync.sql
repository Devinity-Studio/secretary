-- ============================================================
-- MyDesk — Supabase schema for data sync
-- ============================================================
-- Matches the Zustand types in:
--   src/lib/finance/types.ts
--   src/lib/goals/types.ts
--   src/lib/calendar/types.ts
--
-- Each table is scoped to auth.uid() via RLS.
-- Soft delete via deleted_at (NULL = active).
-- ============================================================

-- ── ACCOUNTS ──────────────────────────────────────────────────
create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  type          text not null,  -- cash | bank | credit | savings | ewallet | other
  current_balance numeric not null default 0,
  credit_limit  numeric,
  color         text not null default '#4A5560',
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists accounts_user_idx on public.accounts(user_id) where deleted_at is null;

-- ── TRANSACTIONS ──────────────────────────────────────────────
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,  -- income | expense | transfer
  title         text not null default 'รายการ',
  amount        numeric not null check (amount >= 0),
  account_id    uuid not null references public.accounts(id),
  to_account_id uuid references public.accounts(id),
  category      text not null default 'other_expense',
  date          date not null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists transactions_user_idx on public.transactions(user_id, date) where deleted_at is null;
create index if not exists transactions_account_idx on public.transactions(account_id) where deleted_at is null;

-- ── GOALS ─────────────────────────────────────────────────────
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  type          text not null,  -- savings | habit | general
  target_amount numeric not null check (target_amount > 0),
  unit          text not null default '฿',
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'active',  -- active | completed | cancelled | expired
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists goals_user_idx on public.goals(user_id) where deleted_at is null;

-- ── CONTRIBUTIONS ─────────────────────────────────────────────
create table if not exists public.contributions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  goal_id       uuid not null references public.goals(id) on delete cascade,
  amount        numeric not null check (amount >= 0),
  date          date not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists contributions_goal_idx on public.contributions(goal_id);
create index if not exists contributions_date_idx on public.contributions(user_id, date);

-- ── CALENDAR EVENTS ───────────────────────────────────────────
create table if not exists public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,  -- appointment | leave | reminder | event
  title         text not null,
  date          date not null,
  start_time    text,           -- HH:mm
  end_time      text,           -- HH:mm
  all_day       boolean not null default false,
  leave_type    text,           -- sick | personal | vacation
  note          text,
  color         text not null default '#4338ca',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists calendar_events_user_idx on public.calendar_events(user_id, date) where deleted_at is null;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Every table: users can only read/write their own rows.

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.contributions enable row level security;
alter table public.calendar_events enable row level security;

-- Accounts
create policy "Users can view own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- Transactions
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- Goals
create policy "Users can view own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- Contributions
create policy "Users can view own contributions"
  on public.contributions for select
  using (auth.uid() = user_id);

create policy "Users can insert own contributions"
  on public.contributions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own contributions"
  on public.contributions for update
  using (auth.uid() = user_id);

create policy "Users can delete own contributions"
  on public.contributions for delete
  using (auth.uid() = user_id);

-- Calendar Events
create policy "Users can view own calendar_events"
  on public.calendar_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own calendar_events"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own calendar_events"
  on public.calendar_events for update
  using (auth.uid() = user_id);

create policy "Users can delete own calendar_events"
  on public.calendar_events for delete
  using (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
-- Auto-update updated_at on row modification.

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.accounts
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.transactions
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.goals
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.calendar_events
  for each row execute function public.handle_updated_at();
