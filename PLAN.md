# PLAN: PositiveROI v1

Build order follows [docs/architecture.md](docs/architecture.md) §11. Phase 1 froze the contracts; Phase 2 runs as parallel tracks; Phase 3 is the integration gate before deploy.

## State (updated 2026-07-24, session 2 close)

**LIVE: https://positiveroi-web.vercel.app** on Stav's personal Vercel (project `positiveroi-web`, imported from GitHub — every push to `main` auto-deploys to production; Stav accepted continuous deploy for beta). Tracks G + H + H2 all shipped: first-run overhaul, conservatism-cut vocabulary, deterministic agent logging, key-out-of-prompts. Smoke-tested live: pages, API auth, signed-in dashboard with real DB data, and a successful magic-link send after Stav added the redirect URLs. Stale Deep33 Vercel projects deleted by Stav. **Next:** Stav completes one real magic-link sign-in from his inbox; then post-launch items (demo workspace, README link, positiveroi.dev, Make end-to-end test against the live URL). Track I (sandbox/Cowork tracking) parked.

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

## Track G: first-run experience overhaul (spec agreed 2026-07-24)

Decisions in CONTEXT.md 2026-07-24. All six tasks done and live-verified; review round fixed 6 findings (commit c3af27f).

- [x] G1 Receipt as a flow: quiet until baseline entered, then animated claim → conservatism cut → credited/run; trust-first framing; credited number editable inline after the cut (commit 4fa6467)
- [x] G2 Copy pass, whole app: cold-read plain language, no internal vocabulary on screen, per-run framing kept, shorter than before (commit f90ea6d)
- [x] G3 Migration 0010: `workspaces.website`, `workspaces.company_size`, `workspaces.logo_url`, `members.builder_type`, `hourly_rate_cents` nullable (null = unset). File + applied to prod (commit f83518a)
- [x] G4 Hourly rate optional: out of every setup path; settings frames it as "convert hours to money"; dashboards lead with hours, money renders only when a rate is set, labeled estimate (commit 07880e4)
- [x] G5 Agent prompts in the capture step for all builders: copy-paste prompt per tool type (Claude Code / Cursor / Codex), key in its own box with password-style subtext, plugin surfaced for skills, MCP for agents, code detail behind a toggle (commit 2c4833d)
- [x] G6 Onboarding rebuild: instant signup → company name + website (logo fetched from the site) + size (Just me / 2-10 / 11-50 / 51+) + builder type (kept as signal; UI same for both) → connect first tool (embedded capture with G5 prompts + inline key) → live wait → confetti + first receipt → tour (metrics, invite team, public page). Invited members get builder type only (commit 05eae8d)

## Track H: Track-G polish (Stav's second hands-on review, 2026-07-24) — DONE (commit 2ef276a, live-verified)

- [x] H1 Builder question rephrased: "Are you a technical or non-technical builder?" — everyone builds with AI
- [x] H2 Onboarding opening screen before the wizard: "Let's connect your first tool"
- [x] H3 Skill path: plugin steps shown openly (not behind a toggle) — the plugin IS the capture for skills
- [x] H4 "By hand" framing → "before this tool" (the old way may itself have been ChatGPT): step title, question, receipt labels
- [x] H5 "Credit/credited" off the screens → "time saved" vocabulary; step title "Your number" → "Time saved"
- [x] H6 "How the cut works" becomes a popup in the wizard — no navigation, no lost state
- [x] H7 API key separated from the agent prompt: prompts reference an env var, key box tells the human to set it themselves and never paste it into an AI chat

## Track I: sandbox/Cowork skill tracking (parked — Stav 2026-07-24: "we'll add it later")

Goal: skill runs made inside Cowork or other sandboxed environments count, with setup done once instead of per session. Flow agreed in chat 2026-07-24; details in CONTEXT.

- [ ] I1 Plugin configurable purely through injected settings (key, endpoint, tracked-skills list via env vars / Cowork plugin settings — capture.mjs already prefers env vars, extend to the tools list)
- [ ] I2 Ingest domain onto sandbox allowlists (ship on the standard list or a one-time admin approval path)
- [ ] I3 Loud failure instead of silence: when the plugin can't reach the server from a sandbox, tell the user in-session that runs aren't being counted and what to ask their admin
- [ ] I4 Docs: a "tracking from Cowork/sandboxes" section in the plugin quickstart

## Deploy (moved to Stav's personal Vercel, 2026-07-24)

- [x] **Live at https://positiveroi-web.vercel.app** — Stav imported the GitHub repo into his personal Vercel (project `positiveroi-web`, root `apps/web`, env pasted from `.env.local` + `NEXT_PUBLIC_DEPLOYMENT=hosted`). Smoke-tested live: all public pages 200, new Track G/H copy serving, ingest API rejects unauthenticated calls, signed-in dashboard renders with real DB data (QA user, deleted after).
- [x] **Magic-link redirect** configured by Stav; live send verified ("Check your email" on production, 2026-07-24). Final confirmation: Stav clicks the link in his inbox.
- [x] **Push-to-production model**: Stav chose continuous deploy — every push to `main` goes live. Revisit when there are real users.
- [x] Stale Deep33 projects deleted by Stav (2026-07-24).
- [ ] Post-launch: seed demo workspace, link from README; buy positiveroi.dev and point it at the personal project.

## Deploy history (superseded)

- [x] Vercel project `positiveroi` created (Deep33 org, prj_AaoJ2kVuzZ048EiDcARmjUY57fBV). Monorepo build: root `apps/web`, install + `turbo build --filter=web` from the workspace root. Env set (Supabase URL/anon/service-role, HOSTED_ADMIN_EMAILS, NEXT_PUBLIC_DEPLOYMENT=hosted) on all targets.
- [x] **Preview deployed and smoke-tested 2026-07-11: 28/28 gate checks pass against the live Vercel runtime** (SSR dashboards, all API routes, ingest, read-API scopes, CORS, public page + badge). URL: `positiveroi-539jymeoa-deep33.vercel.app`. (A bare `vercel deploy` auto-promoted the first build to production; the production aliases were removed immediately, so `positiveroi.vercel.app` 404s — **not launched**, per Stav's "preview first" choice.)
- [ ] **Production promotion (Stav's go/no-go).** At promote: `vercel --prod`, then add the production URL to Supabase Auth → URL Configuration → Redirect URLs so magic-link works (the only thing the smoke test couldn't cover — it used password sign-in). positiveroi.dev not purchased yet, so the launch URL would be `positiveroi.vercel.app`.
- [ ] Post-launch: seed demo workspace, link from README
