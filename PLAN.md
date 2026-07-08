# PLAN: PositiveROI v1

Build order follows [docs/architecture.md](docs/architecture.md) §11. Phase 1 froze the contracts; Phase 2 runs as parallel tracks; Phase 3 is the integration gate before deploy.

## State (updated 2026-07-08)

Backend complete and pushed (commits `bef9e60` foundation → `d8766f4` docs/CI → `37e23c1` capture clients → `577b14e` web spine). 100+ tests green across core (21), web spine (47), sdk (11), mcp-server (15), plugin (10). Schema + aggregate RPCs applied to the live Supabase project (`mzkvhihqykzeecbwoigu`). **In progress:** frontend foundation (design system, shell, auth, onboarding) — if the working tree has uncommitted `apps/web` files, that agent's work landed after this update: verify `pnpm -F web typecheck lint build`, then commit. **Next:** frontend page tracks below, then the integration gate, then deploy.

## Phase 0: prerequisites

- [x] Decision Zero: name = PositiveROI (scope `@positiveroi`, prefixes `roi_ingest_`/`roi_read_`, config `~/.positiveroi/`, plugin `positiveroi`)
- [x] Supabase project reachable
- [ ] Google Cloud OAuth client + Supabase redirect URLs (Stav; see QUESTIONS.md, magic link works meanwhile)
- [ ] Vercel production project + env vars (see QUESTIONS.md)
- [ ] SUPABASE_SERVICE_ROLE_KEY into `apps/web/.env.local` + Vercel (Stav; unlocks the live integration suite)

## Phase 1: foundation (frozen) — DONE

- [x] `packages/core`: constants (0.6 / 0.5 / 180, caps, prefixes), `computeMinutesSavedPerRun`, zod schemas (ingest event/batch, tool-create, responses), idempotency key formats, snippet templates; unit tests
- [x] Supabase migrations 0001–0007 (types, workspaces/members/invites, api_keys, tools + baseline audit, events + metrics, badges + rate limits, RLS) — applied to production
- [x] Methodology round-trip: TypeScript function matches the Postgres generated column (~14k cases + live SQL probe)
- [x] Ingest and read API contracts frozen (architecture §4)
- [x] Architecture document committed as `docs/architecture.md`

## Phase 2: parallel tracks

### Track A1: web spine + API routes — DONE (commit 577b14e)

- [x] Middleware (session refresh + `/w` `/onboarding` protection), `guards.ts`, `flags.ts`
- [x] `lib/ingest-core.ts` wired into `POST /api/ingest` (+ CORS/OPTIONS on every API route)
- [x] Read API routes: `/api/v1/stats|timeseries|metrics|summary|tools` with scope shaping
- [x] Key management: generate, hash, verify, revoke, throttled `last_used_at`
- [x] Rate limiting (120/min upsert window) + exact error envelope
- [x] Migration 0008 (aggregate RPC functions `roi_*`) applied to production
- [x] 47 unit tests; live integration suite auto-activates when `SUPABASE_SERVICE_ROLE_KEY` is set

### Track B: packages — DONE (commit 37e23c1)

- [x] `@positiveroi/mcp-server`: config reader (env > `~/.positiveroi/config.json`), 4 tools, stdio, esbuild single-file bundle, 15 tests against a mock ingest server
- [x] `@positiveroi/sdk`: `logRun()` with auto idempotency key, one retry, silent fail; 11 tests
- [x] Claude plugin: `hooks.json` + `capture.mjs` (exfiltration rules, ndjson queue, drain), fixture test shared with core, `impact-setup` + `register-tool` skills, vendored `mcp/server.mjs`, root `marketplace.json`; 10 tests

### Track C: docs + CI — DONE (commit d8766f4)

- [x] README, PRD, CONTEXT, QUESTIONS, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
- [x] docs/: architecture, methodology, 4 quickstarts, ingestion + read API reference, mcp-server, sdk, self-hosting
- [x] `.github/`: CI workflow (lint/typecheck/test/build, DB job soft-fail with TODO, plugin tests), release workflow (disabled until npm org), issue + PR templates
- [ ] CI green on main (verify on GitHub after next push; make the DB job a required check once green)

### Track D: frontend

#### D0: foundation (design system, shell, auth) — IN PROGRESS (agent running at time of update)

- [ ] Design tokens (light+dark) + `components/ui` library + product components (StatTile, MultiplierRing, Receipt, SourceBadge, TierBadge, RunsSparkline, EmptyState)
- [ ] Login (magic link; Google behind `NEXT_PUBLIC_AUTH_GOOGLE=true`), `/auth/callback`, invite accept `/invite/[token]`
- [ ] Onboarding: workspace create (admin member, seeded metrics, default ingest key shown once), silent timezone
- [ ] App shell `/w/[slug]`: sidebar (My Impact / Company / Tools / Builders / Metrics / Settings), workspace switcher, global `?period=` selector, theme toggle

#### D1–D4: pages (launch as parallel agents AFTER D0 is committed; each gets D0's component inventory)

- [ ] D1 Tools: directory, 4-step registration wizard with animated Receipt, live first-run listener (3s poll), test-run + manual-log server actions; tool detail tabs (overview with per-source counts, runs, setup snippets, settings with audited baseline edit + archive)
- [ ] D2 Dashboards: builder (hero stats, Multiplier Ring, tool cards, recent-runs strip, drill-downs) + company (4 headline stats, trend chart, metric tiles, leaderboards, Gone Quiet, lazy badge award) + builders leaderboard page + metrics page
- [ ] D3 Settings + public: general, members + link invites, keys (plaintext-once), public config with live preview; public page `/p/[slug]` + SVG badge `/badge/[slug]` through `public-gate.ts` with cache headers; `/admin` stub (hosted flag)
- [ ] D4 Marketing: landing, `/methodology`, `/pricing` (hosted flag); replace placeholder `src/app/page.tsx`
- [ ] Empty states per PRD screen table (all tracks)

## Phase 3: integration gate (evidence, not "should work")

- [ ] G1 REST path: signup → wizard → curl with real key → run visible on both dashboards → public page + badge show the same number
- [ ] G2 Plugin path: `/plugin marketplace add` → `impact-setup` → `register-tool` → skill invocation → event lands `via hook`
- [ ] G3 MCP path: `log_run` lands `via mcp`; refuses hook-captured tools
- [ ] G4 SDK path: browser-origin `logRun()` lands `via sdk` (proves CORS)
- [ ] G5 Scopes: read key gets `/api/v1/stats`; ingest key gets 403 there and 200 on `/summary`
- [ ] G6 Full CI green including the live integration suite (needs service key)

## Deploy

- [ ] Checkpoint commit, Vercel production deploy (.vercel.app)
- [ ] Live smoke test: G1 loop against production
- [ ] Post-launch: seed demo workspace, link from README
