# PLAN: PositiveROI v1

Build order follows [docs/architecture.md](docs/architecture.md) §11. Phase 1 froze the contracts; Phase 2 runs as parallel tracks; Phase 3 is the integration gate before deploy.

## State (updated 2026-07-10)

Backend, frontend, and the review-round batch are all committed (latest `f3fc260`: builder-set credit, user-level keys, MCP `list_metrics`). Migrations 0001–0009 applied to the live Supabase project (`mzkvhihqykzeecbwoigu`); the service role key is in `.env.local`, so the full live suite runs. Tests green: core 27, web 60 (7 live), sdk 11, mcp-server 19, plugin 10. **Next:** the time-ranges change (rename quarter → last 90 days, add custom from/to picker — decided 2026-07-10), then a full code review, then the integration gate, then deploy.

## Phase 0: prerequisites

- [x] Decision Zero: name = PositiveROI (scope `@positiveroi`, prefixes `roi_ingest_`/`roi_read_`, config `~/.positiveroi/`, plugin `positiveroi`)
- [x] Supabase project reachable
- [ ] Google Cloud OAuth client + Supabase redirect URLs (deferred by Stav 2026-07-10; magic link is the launch auth)
- [ ] Vercel production project + env vars (connector authenticated; Claude creates the project at release)
- [x] SUPABASE_SERVICE_ROLE_KEY in `apps/web/.env.local` (still needed in Vercel env at release)

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

### Track D: frontend — DONE (commits e02a72c, 3116a6b, 94c283e)

- [x] D0 foundation: design tokens (light+dark), `components/ui` library, product components, login (magic link), `/auth/callback`, invite accept, onboarding with key-shown-once, app shell with period selector + theme toggle
- [x] D1 Tools: directory, 4-step wizard with animated Receipt, live first-run listener, test-run + manual-log actions, tool detail tabs with audited baseline edit + archive
- [x] D2 Dashboards: builder + company + builders leaderboard + metrics pages
- [x] D3 Settings + public: general, members + link invites, keys, public config with live preview, `/p/[slug]` + SVG badge, `/admin` stub
- [x] D4 Marketing: landing, `/methodology`, `/pricing`

### Track E: review round (Stav's product review, 2026-07-10) — DONE (commit f3fc260)

- [x] Builder-set credit: wizard credit editor, settings credit panel (owner or lead/admin), `credit_history` audit, builder-set labels on receipts/drill-downs, migration 0009 applied to prod
- [x] User-level API keys: members manage their own, admins see all grouped by owner, read keys admin-only
- [x] MCP `list_metrics` + `GET /api/v1/metric-definitions` (both scopes)
- [x] Time ranges: quarter → last 90 days, custom from/to picker (all-time stays default)

### Track F: deep review (2026-07-11) — DONE (commit 18ba492)

- [x] 10-lens security + quality review, 3-vote adversarial verification: 32 findings, all fixed (open redirect, v1/tools rate limit, invalid-date crash, SDK insecure-context, hook 5xx drop, +27 more)
- [x] Regression tests added; all suites green (core 28, web 73, sdk 12, mcp-server 19, plugin 11)

## Phase 3: integration gate — DONE (28/28 checks, harness in scratchpad, 2026-07-11)

- [x] G1 REST path: signup → tool → curl with real key → dashboard + public page + badge all show 3.2 hrs from the same runs; test run excluded
- [x] G2 Plugin path: hook run lands `via hook` (source=hook), exits 0 with empty stdout
- [x] G3 MCP path: `log_run` lands `via mcp`; refuses hook-captured tool; `list_metrics` answers
- [x] G4 SDK path: browser-origin `logRun()` lands `via sdk`; CORS ACAO on preflight + response
- [x] G5 Scopes: read key gets `/stats` (200), ingest key 403 on `/stats` + 200 on `/summary`, unknown key 401
- [~] G6 CI: the two required jobs (lint/typecheck/test/build, plugin) are green; the optional `db` job (RLS-isolation / migration-from-zero, `continue-on-error`) still fails at the local-stack test step — brittle env, documented TODO. Migrations are separately proven: all 0001–0009 applied cleanly to the live project; the live suite passes locally (7/7).

## Deploy

- [ ] Checkpoint commit, Vercel production deploy (.vercel.app)
- [ ] Live smoke test: G1 loop against production
- [ ] Post-launch: seed demo workspace, link from README
