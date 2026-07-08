# PositiveROI — Working Notes for Claude

Open-source AI impact platform + free hosted SaaS. Companies whose employees ("builders") create AI tools get proof of the value: tools log runs, each run credits conservative minutes saved, dashboards show hours/money/FTE, builders chase the Multiplier badge. Owner: Stav Charkham (product decisions his, technical decisions yours; he doesn't read code — report in product language, prove with evidence, commit checkpoints).

## Read these first

1. [PLAN.md](PLAN.md) — task list + **current build state** (start here to resume)
2. [CONTEXT.md](CONTEXT.md) — every decision and why
3. [PRD.md](PRD.md) — full product spec; [docs/architecture.md](docs/architecture.md) — full technical spec (schema DDL, API contract, screen specs, security)
4. [QUESTIONS.md](QUESTIONS.md) — what's waiting on Stav

## The rules that are the product

- **The Undercount is frozen.** 0.6 confidence factor, 0.5 judgment factor, 180 h/30d Multiplier — live in `packages/core/src/constants.ts` AND as a Postgres generated column on `tools`. Never change one without the other; a round-trip test enforces it. PRs changing the constants get declined.
- **Two auth planes, never mixed.** Humans: Supabase Auth + RLS (SELECT-only — there are deliberately NO write policies). Machines: sha256-hashed API keys in route handlers on the service-role client. Every write goes through server actions/handlers behind `requireMember()` (apps/web/src/lib/guards.ts).
- **`is_test = false` in every aggregate.** A test run leaking into a headline number breaks the product's one promise.
- **The plugin hook never sends prompt content.** Only: tool slug, timestamp, source, hashed idempotency key, `{surface}`. Tests assert this on raw request bytes — keep it that way.
- **Every number must drill to its runs.** New UI showing a total must link down to the events behind it.

## Layout

```
apps/web              Next.js 16 app — dashboard, public pages, ALL API routes
  src/lib             the spine: guards, api-keys, ingest-core, aggregates, public-gate
  src/app/api         /api/ingest + /api/v1/* (contracts: docs/api/*.md)
packages/core         constants, methodology, zod schemas, idempotency, snippets (SOURCE OF TRUTH)
packages/sdk          zero-dep logRun client
packages/mcp-server   4 MCP tools; bundled into the plugin by scripts/bundle-plugin-mcp.mjs
packages/claude-plugin  hook (capture.mjs) + skills + vendored mcp/server.mjs
supabase/migrations   canonical schema (applied to prod via Supabase MCP; files stay canonical)
```

## Working on it

- `pnpm check` = lint + typecheck + test + build everything (turbo). Per-package: `pnpm -F web test`, `pnpm -F @positiveroi/core build`, etc. Plugin tests: `node --test packages/claude-plugin/test/`.
- After changing `packages/mcp-server`: re-run `node scripts/bundle-plugin-mcp.mjs` and commit the refreshed `packages/claude-plugin/mcp/server.mjs`.
- Live Supabase project: `mzkvhihqykzeecbwoigu` (region ap-northeast-1). Schema + `roi_*` RPCs already applied. Apply future migrations BOTH as a numbered file in `supabase/migrations/` AND to prod via the Supabase MCP `apply_migration`.
- `apps/web/.env.local` has real URL + publishable key; `SUPABASE_SERVICE_ROLE_KEY` is EMPTY until Stav pastes it (see QUESTIONS.md #3). The 7 live-integration tests skip themselves until then; everything else runs.
- Design direction (binding, from Stav): simple/clean/cool — Airbnb warmth, Notion minimalism, Arc's confident accent. Dashboards read like a designed document, not a BI tool. Dark + light first-class. Load the frontend-design skill before visual work.
- Writing style for any docs/UI copy: plain, direct, no corporate fluff, no em-dashes.
- Git: commit after each working increment (Stav's rollback safety net); push to `origin main` (github.com/stavcharkham/positiveroi — public, SSH auth works on this machine).
