# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Thunderbolt is a cross-platform AI client built as a Tauri + React + Bun stack. The tree is a polyglot monorepo; it is **not** a workspaces setup — the frontend root and `backend/` each have their own `package.json`, `bun.lock`, `eslint.config.js`, and `tsconfig.json`. You must `cd backend` to operate on backend code.

- `src/` — React 19 frontend (renders in both a web browser and the Tauri webview)
- `backend/src/` — Elysia-on-Bun REST API (inference proxy, auth, PowerSync write bridge)
- `src-tauri/` — Rust-based Tauri shell (desktop, iOS, Android)
- `shared/` — code imported by both frontend and backend (currently just PowerSync table declarations); aliased as `@shared/*`
- `powersync-service/` — Docker Compose stack for local PowerSync + Postgres
- `marketing/` — separate site, not part of the app build
- `.thunderbot/` — git subtree of slash commands pulled from the `thunderbot` repo; sync via `make thunderbot-pull` / `make thunderbot-push`. `.claude/commands/*` are symlinks into this directory created by `make setup-symlinks`.

TypeScript path aliases: `@/*` → `src/*`, `@shared/*` → `shared/*`. Backend has its own `@/*` alias into `backend/src/*`.

## Common Commands

Prefer `make` targets — they wrap both frontend and backend correctly.

```sh
make setup          # install frontend + backend deps + create agent symlinks
make run            # start backend (:8000) and frontend (:5173) together
make docker-up      # start PowerSync + Postgres (required for backend)
make docker-nuke    # destroy all docker data and recreate
make doctor-q       # verify tool versions and .env files (quiet mode)
make check          # type-check + lint + format-check (frontend only)
make format         # format frontend, backend, and Rust
make test           # run both frontend and backend tests
```

Frontend-only (run from repo root):

```sh
bun dev                      # Vite dev server on :1420 (NOT :5173 — that's via `make run`)
bun run test                 # tests in src/ and scripts/ only
bun run test:watch
bun test path/to/file.test.ts   # single test file
bun run type-check           # tsc --noEmit
bun run lint                 # eslint src --ext .ts,.tsx
bun run e2e                  # Playwright
bun run storybook            # Storybook on :6006
bun tauri:dev:desktop        # Tauri desktop dev
bun tauri:dev:ios            # iOS simulator
bun tauri:dev:android        # Android emulator
bun run analyze              # bundle analyzer
bun run db <drizzle-kit cmd> # frontend Drizzle (SQLite)
```

Backend-only (run from `backend/`):

```sh
bun run dev                  # backend dev server
bun test                     # backend tests (from backend/ only)
bun run test:watch
bun test src/path.test.ts    # single test file
bun run type-check
bun db generate              # Drizzle: new migration after editing schema
bun db migrate               # apply migrations
bun run db:dev               # run Postgres via PGLite (serves .pglite/data)
```

**Do not run `bun test` from the repo root without args** — it picks up both frontend and backend suites and misconfigures the test environment. Use `bun run test` (the npm script), which is scoped to `./src ./scripts ./.github/scripts`.

## Architecture

### Local-first data flow

The frontend owns the source of truth. Data lives in a local SQLite database (WA-SQLite in the browser via a SharedWorker, `bun:sqlite` on the desktop Tauri shell — see `src/db/`). PowerSync syncs that SQLite to Postgres on the server. The REST API is only for actions SQLite can't model: auth, LLM inference, MCP proxy, rate limits.

- `src/dal/` — the data access layer. All reads/writes to local SQLite go through here. **When adding new queries, add them to a `dal/` file — don't call Drizzle directly from components or hooks.**
- `src/db/schema.ts` — Drizzle schema for the **frontend** SQLite.
- `backend/src/db/schema.ts` + `powersync-schema.ts` — Drizzle schema for the **backend** Postgres.
- `shared/powersync-tables.ts` — shared table definitions used to generate PowerSync's client-side schema.

### PowerSync and composite primary keys

Default-data tables (`settings`, `models`, `modes`, `tasks`, `prompts`, `model_profiles`) use **composite primary keys `(id, user_id)`** on the backend so each user can have their own row with the same default ID (e.g. `openai-gpt-4o`). The frontend schema uses a single-column PK because local data is per-device.

When adding a new PowerSync-synced table:

- Add a `user_id` column + index: `index('idx_[table]_user_id').on(table.userId)`. PowerSync sync rules filter by `user_id`, so this index is required.
- For default-seeded tables, use a composite PK and update `powersyncConflictTarget` in `backend/src/db/powersync-schema.ts` (and `powersyncPkColumn` for the business-id column used in PATCH/DELETE WHERE).
- **Do not** add composite foreign key constraints, active indexes (`WHERE deletedAt IS NULL`), or indexes on FK columns. The backend is a sync server — joins happen in the frontend SQLite, and encrypted data can't be indexed meaningfully anyway.

Full rationale in `docs/composite-primary-keys-and-default-data.md`.

### Default-data reconciliation

`src/lib/reconcile-defaults.ts` seeds the default settings/models/modes/tasks/prompts on app init. The `default_hash` column tracks whether a user has modified a default row; unmodified rows get updated when app defaults change.

### AI / inference

- `src/ai/` — frontend AI: prompt building (`prompt.ts`), streaming (`streaming/`), tokenizers, step logic, widget parser. Uses the Vercel AI SDK (`ai`, `@ai-sdk/*`) and MCP client (`@modelcontextprotocol/sdk`).
- `backend/src/inference/routes.ts` — SSE streaming proxy to LLM providers. The frontend never calls provider APIs directly (except in "bring your own key" mode); it calls the backend, which enforces rate limits and routing.

### E2E encryption (optional)

When enabled (`VITE_E2EE_ENABLED`, default on), data is encrypted client-side before sync. See `src/crypto/`, `backend/src/api/encryption.ts`, and `docs/e2e-encryption.md`. Because the server can't read user data, **don't design backend queries that assume readable payload fields** for synced tables.

### Backend shape

Elysia (Bun) app in `backend/src/index.ts`. Routes are factories (`create*Routes(deps)`) that take an `AppDeps` so tests can inject a `database` and `fetchFn`. Swagger at `/v1/swagger` when `SWAGGER_ENABLED=true`.

## Testing Conventions

From `docs/testing.md` — violating these causes CI-only flakiness:

- **Prefer dependency injection over mocking.** Network clients should accept an injected `httpClient` / `fetch` — don't `mock.module('ky', …)`.
- **Never `mock.module()` a shared internal module** (e.g. `@/hooks/use-settings`, `@/components/ui/dialog`). Bun's `mock.module()` is global and persistent across test files in the same worker — an incomplete mock in one file crashes unrelated tests. Only mock truly external things (auth client, third-party APIs, `react-router`, missing browser APIs). If you absolutely must mock a shared UI module, export **every** member.
- **Fake timers are installed globally.** Use `getClock()` from `@/testing-library` (`getClock().tickAsync(300)` or `.runAllAsync()`) to advance time. Don't `jest.useFakeTimers()`-style setup per test.
- **Suppress expected console errors** with `spyOn(console, 'error').mockImplementation(() => {})` in `beforeAll` for tests that intentionally throw.
- For DAL tests, use the real test database: `setupTestDatabase / teardownTestDatabase / resetTestDatabase` from `@/dal/test-utils` + `createTestProvider` from `@/test-utils/test-provider`.

## Other Notes

- Source maps are **off** by default so forks don't leak proprietary code. Set `ENABLE_SOURCEMAP=true` (CI only) to emit hidden maps for PostHog.
- `VITE_BYPASS_WAITLIST=true` only bypasses the frontend waitlist gate — the backend still enforces it. Useful for UI-only development.
- Vite dev server listens on port **1420** (fixed, for Tauri); `make run`'s frontend listens on **5173** (via the `dev` script's environment).
- Frontend ESLint explicitly **ignores `backend/`**. Lint backend code from inside `backend/` with its own config.
- Husky + lint-staged run on commit. If a pre-commit hook fails, fix the issue and make a **new** commit — never `--amend` or `--no-verify`.
- `.claude/commands/*.md` are git-subtree-managed symlinks. To edit one locally, run `make thunderbot-customize FILE=<name>.md` first, which replaces the symlink with a writable copy.
