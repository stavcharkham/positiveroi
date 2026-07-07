# CONTEXT: decision log

Started 2026-07-08. Product decisions are Stav's; technical decisions are Claude's. New entries go on top of each section with a date.

## Product decisions (Stav)

**2026-07-08**

- **Platform, not a plugin generator.** Build the impact platform itself (capture + dashboards + methodology) rather than a tool that generates per-company tracking plugins. The value is the trusted number, not the scaffolding.
- **Audience is both builder and leadership.** The builder gets progress and badges; leadership gets the headline and the drill-down. One product, two dashboards, same data.
- **Capture follows the tool type.** Automations POST per run, Claude Code skills go through the plugin hook, apps use the SDK, agents use MCP. Meet each tool where it runs; never ask a builder to log by hand as the primary path.
- **Metrics: custom per workspace, with defaults.** Every workspace starts with revenue influenced, leads generated, client touchpoints; teams add their own. Time saved is the floor, not the whole story.
- **Credibility: traceable and labeled beats impressive.** Runs are measured, minutes are labeled estimates, every number drills to its runs. This is the product's one promise.
- **Public impact page: yes.** Opt-in, config-gated, with an embeddable badge. The footer link is the growth loop.
- **The workflow-mapping spreadsheet stays a separate deliverable.** Its conservative-estimate approach is what became The Undercount; the xlsx itself is consulting material, not product.
- **Name: PositiveROI.** Rejected: Winback, Recoup, Freedup, Timeproof. "Multiplier" survives only as the badge name.
- **Pricing: free hosted beta + $29/month flat.** Free up to 5 builders (copy, not enforcement), Team $29 flat unlimited, self-hosted free forever. No billing code in v1.
- **Public on personal GitHub from day one** (github.com/stavcharkham/positiveroi), MIT, built in public.
- **Ship on .vercel.app first**; buy positiveroi.dev later.
- **Design direction: Airbnb/Notion/Arc territory.** Warm, confident, product-grade; not dashboard-vendor gray.

## Technical decisions (Claude)

**2026-07-08, architecture** (details in [docs/architecture.md](docs/architecture.md))

- One Next.js App Router app serves dashboard, public pages, and all API routes; one Supabase Postgres; no queues, cron, or edge functions in v1.
- pnpm + turbo monorepo: `apps/web`, `packages/{core,sdk,mcp-server,claude-plugin}`.
- Next 16 + Tailwind 4 + shadcn/ui.
- Two auth planes that never mix: humans via Supabase Auth + RLS, machines via hashed API keys on the service-role client. RLS grants SELECT only; there are no insert/update/delete policies. All writes go through one guarded server path.
- Ingest: single endpoint `POST /api/ingest`, accepts one event or a 1–100 batch.
- Read API paths: `/api/v1/stats|tools|timeseries|metrics|summary`.
- IA: `/w/[slug]` prefix with a flat page set; cut builder profiles, `/account`, `/settings/plan`, in-app docs.
- Multiplier window: trailing 30 days everywhere; all calendar-month machinery deleted.
- Badge storage: only `multiplier` is stored (permanent); all tiers and ×2/×3 are display-only labels from the same trailing-30d number.
- Idempotency is tool-scoped: `unique (tool_id, idempotency_key)`; key formats pinned in core plus a shared fixture test.
- Hook/MCP double-count guard is client-side: plugin config marks hook-captured tools and `log_run` refuses them; no server-side time-window dedup; per-source counts make failures visible.
- `source` field lives in the zod schema, optional, default `rest`; `manual` is rejected from API keys (dashboard-internal only).
- Key prefixes: `roi_ingest_` / `roi_read_`; sha256-hashed at rest, prefix stored for display.
- Migration order: `api_keys` before `events` (FK ordering).
- Test runs: kept as a first-class `is_test` flag, excluded from every aggregate; the auto-created sample tool was cut.
- Defaults: hourly rate $60 (6000 cents); public page ISR 300s; badge `s-maxage` 3600.
- Manual runs and test runs go through the same server ingest function (`source: manual`, `created_by` set); no RLS insert policies anywhere.
- Baseline edits: lead/admin only, recorded in a bare `baseline_history` table (who/when/old/new).
- Dashboard data layer: server components call `lib/aggregates.ts` on the service role behind `requireMember`; the browser never queries Postgres directly.
- Invites: link-only in v1, multi-use with `max_uses`, revocable, 14-day expiry, token stored hashed; email invites deferred.
- Tool status: `active | archived` only; "awaiting first run" and "gone quiet" are derived, never stored.
- MCP server is vendored into the plugin as an esbuild bundle; npm publishing is off the critical path (Changesets configured, publish disabled until the org exists).
- Auth is magic-link-first; Google OAuth activates the moment Stav creates the OAuth client (no code change).
- Migrations were applied to the hosted Supabase project via the Supabase MCP as combined statements; the numbered files in `supabase/migrations/` stay canonical for self-hosters and CI.
- Ingest keys deliberately get a narrow read window (`/api/v1/summary` + slim tool list) so setup verification and progress narration work without a read key; the leak surface approximates a public page.
- API-created tools are capped at 120 raw minutes, stamped `origin='api'`, audited, and surfaced for review; dashboard cap is 480 with a soft warning at 240. No approval workflow in v1.
