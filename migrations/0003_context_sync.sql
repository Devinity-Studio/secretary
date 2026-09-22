-- ============================================================
-- คุณเลขา — Context sync schema (ขั้น 1: migration + RLS)
-- ============================================================
-- Matches the Zustand types in src/lib/context/types.ts:
--   SecretaryContext → public.contexts
--   Evidence         → public.context_evidence
--
-- Conventions carried over from 0002_supabase_sync.sql:
--   - Every table is scoped to auth.uid() via RLS.
--   - Soft delete via deleted_at (NULL = active).
--   - Nested domain structures (facts, inferences, links, history, …)
--     live in jsonb columns — the browser is the domain authority and the
--     client sends whole rows, so no relational decomposition is needed.
--
-- NOTE: unlike the 0002 tables, `contexts` has NO updated_at trigger on
-- purpose. The client's `updated_at` is authoritative for last-write-wins
-- conflict resolution on pull — a server-side now() would erase the
-- ordering information the merge relies on.
-- ============================================================

-- ── CONTEXTS ─────────────────────────────────────────────────
create table if not exists public.contexts (
  id                   text primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  type                 text not null default 'unknown',
  lifecycle            text not null default 'tentative',
  evidence_ids         jsonb not null default '[]'::jsonb,
  facts                jsonb not null default '[]'::jsonb,
  inferences           jsonb not null default '[]'::jsonb,
  primary_source       text not null default 'user',
  sources              jsonb not null default '[]'::jsonb,
  links                jsonb not null default '[]'::jsonb,
  related_contexts     jsonb not null default '[]'::jsonb,
  history              jsonb not null default '[]'::jsonb,
  created_by           text not null default 'user',
  expires_at           timestamptz,
  priority             integer not null default 50,
  tags                 jsonb not null default '[]'::jsonb,
  archived             boolean not null default false,
  shared_with_user_ids jsonb,
  canonical_id         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists contexts_user_idx on public.contexts(user_id) where deleted_at is null;

-- ── CONTEXT EVIDENCE (immutable) ─────────────────────────────
create table if not exists public.context_evidence (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id   text,
  content     jsonb not null,
  captured_at timestamptz not null default now(),
  confidence  text not null default 'unknown',
  created_at  timestamptz not null default now()
);

create index if not exists context_evidence_user_idx on public.context_evidence(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Same policy shape as 0002: users can only read/write their own rows.

alter table public.contexts enable row level security;
alter table public.context_evidence enable row level security;

-- Contexts — drop guards ทำให้รันซ้ำได้ปลอดภัย (กด Run ซ้ำไม่เป็น error)
drop policy if exists "Users can view own contexts" on public.contexts;
drop policy if exists "Users can insert own contexts" on public.contexts;
drop policy if exists "Users can update own contexts" on public.contexts;
drop policy if exists "Users can delete own contexts" on public.contexts;

create policy "Users can view own contexts"
  on public.contexts for select
  using (auth.uid() = user_id);

create policy "Users can insert own contexts"
  on public.contexts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own contexts"
  on public.contexts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own contexts"
  on public.contexts for delete
  using (auth.uid() = user_id);

-- Context evidence
drop policy if exists "Users can view own context_evidence" on public.context_evidence;
drop policy if exists "Users can insert own context_evidence" on public.context_evidence;
drop policy if exists "Users can update own context_evidence" on public.context_evidence;
drop policy if exists "Users can delete own context_evidence" on public.context_evidence;

create policy "Users can view own context_evidence"
  on public.context_evidence for select
  using (auth.uid() = user_id);

create policy "Users can insert own context_evidence"
  on public.context_evidence for insert
  with check (auth.uid() = user_id);

create policy "Users can update own context_evidence"
  on public.context_evidence for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own context_evidence"
  on public.context_evidence for delete
  using (auth.uid() = user_id);
