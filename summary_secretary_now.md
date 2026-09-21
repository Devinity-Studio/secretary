# Secretary — where it actually stands (repo / branch / architecture read)

## 1. Branch and commit state

- Branch: `main` (the only committed branch).
- HEAD is a WIP commit on top of:
  - `243b490 feat: Supabase sync layer + typecheck fixes + startup.sh fix`
- Recent commit history, in rough order:
  - rebrand: rename “MyDesk” → “คุณเลขา / Secretary”
  - fix: React error #185 infinite re-render in GoalCard + PGLite auth schema bootstrap
  - fix: remove `db:migrate` from the build script
  - feat: Supabase database schema for data sync
  - fix: Calendar infinite loop + Supabase SSR env var handling
  - feat(context): implement Context canonical domain model
  - docs: add Secretary Audit + Gap Analysis Report
  - feat: add Secretary Architecture document + development plan
  - feat: Supabase sync layer + typecheck fixes + startup.sh fix
  - WIP on top of that
- Other local branches exist (`uncovered-parrotfish`, `honorable-uniform`), but nothing looks active in place of `main`.

## 2. Working tree state on `main` right now

Untracked / uncommitted material sitting in the working tree:

- `docs/AUDIT-GAP-ANALYSIS.md`
- `docs/SECRETARY-ARCHITECTURE.md`
- `src/lib/context/` (types, store, test)

There are also still-present local script/route tweaks in the working tree:

- `scripts/browser-smoke.mjs`
- `scripts/preview-thumbnail.mjs`
- `src/routes/__root.tsx`
- `startup.sh`

Plus a pile of artifact / screenshot / logo files not yet committed.

## 3. Architecture / where Secretary actually is

Scaffold contract is in place:

- `src/router.tsx` (`getRouter()`)
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/styles.css`
- `startup.sh`
- `vite.config.ts`

App shell already has auth + bridge wiring:

- `<AuthProvider>`
- `<PreviewHostBridge />`
- Toaster
- app name “คุณเลขา”

Feature surface exists as real UI + state (not wireframes):

- finance home: summary, period switch, transactions, form
- goals
- calendar
- capture bar
- goal card
- etc.

Infra is prepared but not necessarily “turned on” everywhere:

- `src/lib/db.ts`: Neon or PGLite fallback, migrations in `migrations/*.sql`
- `src/lib/auth/*`: self-hosted Better Auth + broker federation + `authMiddleware` in `middleware.ts`
- `src/lib/supabase/*`: server/client/sync helpers for accounts, transactions, goals, contributions, calendar events
- `migrations/0002_supabase_sync.sql`: sync schema with RLS + soft delete

Honest handoff read:

- Secretary is not at “just starting scaffolding.”
- The web app already has real routes, shell, and visible UI pieces.
- Auth + DB + Supabase sync infrastructure is laid out, but the living app looks more like local-store-first with sync/auth layer ready beside it.
- The working tree now also carries a planning/analysis layer (audit, architecture, context model) that likely defines what should be continued next.

## 4. Best candidate handoff points

- Continue from the current web app’s feature surface, then decide whether to turn auth/Supabase sync on fully, or keep it local-first and optional.
- Continue from the docs: Audit/Gap + Architecture + context model, since those now exist in the working tree.
- Continue from `artifacts/mobile/` if the next target is mobile rather than web.
- Continue from the brand/asset pile if the next job is branding/Brand asset pass.

## 5. If followed up further (still no edits)

Good next confirmation reads, without changing anything:

1. Whether auth/sync is actually wired into the live routes today.
2. What the Audit/Gap + Architecture docs say the next continuation point is.
3. Whether the `artifacts/mobile/` tree is a separate app or parallel to the web app.

## 6. Startup Gate evidence (post Windows command-resolution fix)

Symptom: `npm run dev` died with `spawn vite ENOENT` on Windows.

Root cause: npm installs only `.cmd` / `.ps1` shims on Windows, and Node's
`spawn` (no shell) ignores `PATHEXT`, so `scripts/with-app-env.mjs`
spawning `"vite"` directly could never resolve it. POSIX `.bin` shims are
real executables, which is why the sandbox path always worked.

Minimal fix: `resolveCommand()` in `scripts/with-app-env.mjs` — on win32
only, a command that names a local package is rerouted to its `bin/*.js`
entry via `process.execPath`. POSIX behavior untouched; `preview.mjs` and
`startup.sh` deliberately not modified.

Gate results (all reproduced on this machine):

| Gate | Status |
| --- | --- |
| TypeScript (`tsc --noEmit`) | ✅ PASS |
| Vite startup (`startup.sh` → dev on `0.0.0.0:8080`) | ✅ PASS |
| Build (`npm run build`) | ✅ PASS |
| Built-output preview (loopback :8081) | ✅ HTTP 200 |
| Desktop UI render (screenshot inspected) | ✅ PASS |
| Mobile UI render 390×844 (no overflow) | ✅ PASS |
| Console errors | ✅ none |
| App logic/UI changes | 🔒 none (infra-only fix) |

Regression suite: scripts 193 pass / 2 skipped + app logic 38/38 — zero
failures on both platforms. The 2 symlink tests
(`check-auth-invariant.test.mjs`, `with-app-env.test.mjs`) need OS-level
symlink support (admin/Developer Mode on Windows, where their setup used
to die at `symlinkSync` with `EPERM`); they now probe the capability and
skip with an explicit reason instead of failing, and still run for real
on the POSIX sandbox.

Follow-up found while re-running `npm test` on Windows: the single-quoted
`scripts/**/*.test.mjs` glob never survives cmd.exe, so the infra half
of the suite was silently 0 tests there (bash expanded it, masking the
bug). The test script now passes `"scripts/*.test.mjs"` unquoted so
node's own glob resolves it on every platform — same 195 tests in both
shells.
