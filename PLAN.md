# PLAN: PositiveROI v1

Build order follows [docs/architecture.md](docs/architecture.md) §11. Phase 1 froze the contracts; Phase 2 runs as parallel tracks; Phase 3 is the integration gate before deploy.

## Phase 0: prerequisites

- [x] Decision Zero: name = PositiveROI (scope `@positiveroi`, prefixes `roi_ingest_`/`roi_read_`, config `~/.positiveroi/`, plugin `positiveroi`)
- [x] Supabase project reachable
- [ ] Google Cloud OAuth client + Supabase redirect URLs (Stav; see QUESTIONS.md, magic link works meanwhile)
- [ ] Vercel production project + env vars (see QUESTIONS.md)

## Phase 1: foundation (frozen)

- [x] `packages/core`: constants (0.6 / 0.5 / 180, caps, prefixes), `computeMinutesSavedPerRun`, zod schemas (ingest event/batch, tool-create, responses), idempotency key formats, snippet templates; unit tests
- [x] Supabase migrations 0001–0007 (types, workspaces/members/invites, api_keys, tools + baseline audit, events + metrics, badges + rate limits, RLS)
- [x] Methodology round-trip: TypeScript function matches the Postgres generated column
- [x] Ingest and read API contracts frozen (architecture §4)
- [x] Architecture document committed as `docs/architecture.md`

## Phase 2: parallel tracks

### Track A1: web spine + API routes

- [ ] Auth: login (magic link first), `/auth/callback`, middleware, onboarding + atomic workspace creation (admin member, seeded metrics, default ingest key), invite accept flow
- [ ] App shell: `/w/[slug]` layout, sidebar, workspace switcher, global period selector, theming, `guards.ts`, `flags.ts`
- [ ] `lib/ingest-core.ts` wired into `POST /api/ingest` (+ CORS/OPTIONS)
- [ ] Read API routes: `/api/v1/stats|timeseries|metrics|summary|tools` with scope shaping
- [ ] Key management: generate, hash, verify, revoke, throttled `last_used_at`
- [ ] Rate limiting (120/min upsert window) + error envelope

### Track B: packages

- [ ] `@positiveroi/mcp-server`: config reader (env > `~/.positiveroi/config.json`), 4 tools, stdio, esbuild single-file bundle, tests against a mock ingest server
- [ ] `@positiveroi/sdk`: `logRun()` with auto idempotency key, one retry, silent fail; tests
- [ ] Claude plugin: `hooks.json` + `capture.mjs` (exfiltration rules, ndjson queue, drain), fixture test shared with core, `impact-setup` + `register-tool` skills, vendored `mcp/server.mjs`, `marketplace.json`

### Track C: docs + CI (this track)

- [ ] README, PRD, CONTEXT, QUESTIONS, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
- [ ] docs/: architecture, methodology, 4 quickstarts, ingestion + read API reference, mcp-server, sdk, self-hosting
- [ ] `.github/`: CI workflow (lint/typecheck/test/build, DB job, plugin tests), release workflow (disabled until npm org), issue + PR templates
- [ ] CI green on main

### Track D: frontend

- [ ] Tools: directory, 4-step registration wizard with animated Receipt, live first-run listener (3s poll), test-run + manual-log actions
- [ ] Tool detail tabs: overview (per-source counts), runs, setup (snippets), settings (audited baseline edit, archive)
- [ ] Builder dashboard: hero stats, Multiplier Ring, tool cards, recent-runs strip, drill-downs
- [ ] Company dashboard: 4 headline stats, trend chart, metric tiles, leaderboards, Gone Quiet, lazy badge award
- [ ] Settings: general, members + link invites, keys (plaintext-once), public config with live preview
- [ ] Public page `/p/[slug]` + SVG badge through the single public gate; cache headers; gate test
- [ ] Landing, `/methodology`, `/pricing` (hosted flag), `/admin` stub
- [ ] Empty states per PRD screen table

## Phase 3: integration gate

- [ ] G1 REST path: signup → wizard → curl with real key → run visible on both dashboards → public page + badge show the same number
- [ ] G2 Plugin path: `/plugin marketplace add` → `impact-setup` → `register-tool` → skill invocation → event lands `via hook`
- [ ] G3 MCP path: `log_run` lands `via mcp`; refuses hook-captured tools
- [ ] G4 SDK path: browser-origin `logRun()` lands `via sdk` (proves CORS)
- [ ] G5 Scopes: read key gets `/api/v1/stats`; ingest key gets 403 there and 200 on `/summary`
- [ ] G6 Full CI green including RLS isolation suite

## Deploy

- [ ] Checkpoint commit, Vercel production deploy (.vercel.app)
- [ ] Live smoke test: G1 loop against production
- [ ] Post-launch: seed demo workspace, link from README
