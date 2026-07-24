# CONTEXT: decision log

Started 2026-07-08. Product decisions are Stav's; technical decisions are Claude's. New entries go on top of each section with a date.

## Product decisions (Stav)

**2026-07-24, launch**

- **Hosting: Stav's personal Vercel account**, not Deep33. Project `positiveroi-web`, imported from GitHub by Stav; live at https://positiveroi-web.vercel.app. The two stale Deep33 projects were deleted.
- **Continuous deploy accepted for beta**: every push to `main` goes straight to production. Revisit (separate production branch, preview gate) once there are real users.
- Magic-link redirect URLs configured by Stav in Supabase; live send verified.


**2026-07-24, third round (Track H follow-ups)**

- **The 40% cut is named the "conservatism cut"** on every screen (was "trust cut", before that "confidence cut" internally).
- **MCP is for the coding assistant, not the built agent.** A tracked agent logs runs with a deterministic POST wired into its code at job completion (never a model-invoked tool). The MCP server remains the way Claude Code/Cursor register tools and log/summarize while building. Agent-type capture instructions are REST, same as automations.
- **Idempotency is not prescribed to agents.** The API keeps accepting `idempotency_key` (optional, dedup contract unchanged) but prompts no longer teach it; clients invent their own conventions, our SDK/plugin/hook keep generating theirs.
- **Agent prompts must have the coding assistant verify `POSITIVEROI_API_KEY` is set** and ask the human to add it when missing; the key value never enters an AI chat.
- **Sandbox/Cowork skill tracking known limitation** (answered for Stav): the plugin hook works where it is installed, configured, and allowed outbound network. Fresh sandboxes lose config and queued events and may block egress, so hook capture there is not guaranteed; the reliable sandbox path is the POST inside the tool. The plugin ships in the open-source repo and works self-hosted (endpoint configurable).
- **Sandbox fix parked as Track I** (Stav: build later, not now). Agreed target flow: one-time setup (install plugin in Cowork, paste key + tracked-skills into plugin settings, domain on the allowlist) → every later session tracks with zero per-session setup → and when tracking can't reach the server, the session says so out loud instead of dropping runs silently. Sized small-to-medium: the plugin already prefers env-var config, so the work is settings injection, the allowlist path, and the loud-failure notice. Not a launch blocker.

**2026-07-24** (first hands-on test, dev env → Track G)

- **Hourly rate is optional and lives in settings**, framed as "convert hours to money". Out of every setup path. Dashboards lead with hours; money shows only when a rate is set, labeled as an estimate. No per-builder rates (salary proxy).
- **Onboarding rebuilt around first-run-as-first-success**: instant signup, then company name + website (logo pulled from the site) + company size (Just me / 2-10 / 11-50 / 51+) + builder type (non-technical / technical — kept as a signal even though both see the same UI; everyone builds with AI coding tools, Make/Zapier de-emphasized), then connect-first-tool, live wait, confetti (whimsical), then the tour. Invites come after the first success, not before.
- **API key appears inside the connect step**, its own box near the prompt, password-style subtext. Never a standalone screen.
- **The receipt is a flow, not a table**: nothing shows until the builder enters their by-hand time, then the cut plays visually. Framing is trust-first: trust is everything when measuring your own tools, so a conservatism formula is applied — the visual explains it. The credited number is easily editable right after the cut.
- **Agent prompts lead capture for every builder type**: copy-paste prompts for Claude Code / Cursor / Codex per tool type, explaining most inline and linking docs. The existing plugin and MCP server get surfaced to everyone; raw code detail no longer leads.
- **Whole-app copy pass**: plain, human, first-time-comprehensible, concise; internal vocabulary stays internal; per-run framing kept ("How long did this take by hand, each time?").
- **Make/external-caller testing waits for the production URL** (cloud services can't reach localhost; tunnels rejected in favor of the real thing).

- **The credited number is editable, fully free within the schema ceiling.** The Undercount becomes the suggested default with its rationale shown; the builder sets the final minutes/run at registration and later in the dashboard. Numbers differing from the suggestion are labeled "builder-set" on receipts and drill-downs — transparency replaces the lock. The 480-min ceiling (one 8h workday per run) stays as a typo/abuse bound, not a distrust of builders; raise it later if a real multi-day-per-run case appears. The suggested-value math (constants, generated column, round-trip test) stays frozen.
- **API keys are user-level.** Every member creates and revokes their own keys; admins see all. Offboarding = revoke that person's keys; nobody else rotates anything. Read-scope key creation stays admin-only (read keys expose company-wide data).
- **Agents must be able to discover business KPIs.** MCP gets `list_metrics` (backed by a definitions-only endpoint open to both key scopes); admins define KPIs in the dashboard.
- **Time ranges everywhere: last 7 / last 30 / last 90 days / custom range** (quarter renamed and pinned to 90 days; custom from/to picker; all-time stays as default).
- **/admin restricted to stav@verticalbuilders.dev and stavchark@gmail.com.**
- **Upgrade contact: stav@verticalbuilders.dev.** Pricing FAQ "builder" definition: "The person who built the tools."
- **Google OAuth deferred**; magic link is the launch auth. Repo lives at `~/Desktop/cool-projects/positiveroi` now.

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

**2026-07-24, Track G build**

- Receipt-flow stage math lives in `apps/web/src/lib/receipt-stages.ts` (pure, tested against the frozen core function); the animated `ReceiptFlow` component is wizard-only, the static `Receipt` stays for detail pages and docs. On-screen cut vocabulary is now "Trust cut −40%" / "A person still checks ÷2" everywhere; "The Undercount" survives only where it is introduced (methodology, marketing, the undercounted-tag popover).
- Agent prompts (`agentPrompt` in `@positiveroi/core/snippets`) are the single source for the wizard, Setup tab, and docs; skill prompts route through the plugin (no endpoint inline), agent prompts through MCP.
- Onboarding hands the fresh ingest key to the wizard via sessionStorage (`onboardingKeySlot`), never a URL; the wizard reads it on tool creation and the capture step clears it on any exit. Confetti = `canvas-confetti`, dynamically imported, skipped under reduced motion.
- Company logo = the website's own `/favicon.ico`, fetched server-side at profile save with an SSRF guard (`lib/net-guard.ts`: https-only, default port, all resolved IPs public, no redirects). No third-party favicon services. Sites without a plain favicon.ico silently get no logo (v1 limitation; HTML `<link rel=icon>` parsing is a later improvement).
- `hourly_rate_cents` null = unset (migration 0010 dropped default + not-null). Read API returns `money_value: null`; public page hides money; inline set-rate rejects empty submits (clearing is settings-only). Existing workspaces kept their old 6000 value.
- Profile answers are a signal, never a gate: `saveWorkspaceProfileAction` failures don't block onboarding; builder type is per-member (invited members answer on the accept screen), website/size are workspace-level, admin-only.

- Ran a 10-lens security + quality review (each finding verified by 3 adversarial skeptics): 32 real defects, all fixed. Notable: a backslash open-redirect in `safeNextPath`, no rate limit on `POST /api/v1/tools`, calendar-invalid custom date ranges crashing dashboards, and the SDK throwing on insecure-context browsers where `crypto.randomUUID` is undefined. Full list and the fix commit: `18ba492`.
- Server actions across the app now wrap their awaited call in try/catch+finally — a rejected action (network blip) previously left the button spinning forever.
- Hook queue drain keeps events on 5xx (nothing judged) and enqueues with an atomic append; the per-fetch timeout dropped to 2s so two sequential POSTs fit the 5s hook budget.
- CI fixes: `lint` now depends on `^build` (mcp-server/sdk lint is `tsc` and needs core's dist cold); DB job boots the full local stack and authenticates the Supabase CLI release lookup.

**2026-07-10, review round + time ranges**

- Credit edit permission: the tool's **owner** edits their own credit (that is Stav's "builder sets it later in the dashboard"); leads/admins edit any. Baseline edit stays lead/admin-only.
- `GET /api/v1/tools` returns the **effective** credited minutes in `minutes_saved_per_run` (builder-set when present, else the suggestion) — same number new runs snapshot; field name and meaning unchanged.
- Custom date range rides the existing single `?period=` param as `from..to` (e.g. `2026-05-01..2026-06-12`) so every drill-down link keeps threading one param; the REST read API keeps its documented separate `from`/`to`. `quarter` stays as the URL/API value (back-compat) but is pinned to a trailing 90 days and labeled "Last 90 days".
- `tool_totals` trailing-30d window ends at now **+5 minutes** (the same future tolerance the occurred_at bounds allow): DB-defaulted `occurred_at` comes from Postgres's clock, and with the app clock behind it, a just-logged run was missing from its own totals. Caught by the live suite.

**2026-07-08, build execution** (deviations and refinements recorded while the tracks were built)

- `verifyApiKey` also returns `createdBy` — POST /api/v1/tools needs it as the tool's `owner_id`.
- Extra RPC `roi_tool_stats(ws)` added in migration 0008 — the read-scope tools list needs per-tool rollups and supabase-js cannot GROUP BY.
- `roi_gone_quiet` filters `status = 'active'` — archived tools should not nag.
- Rate limiting fails open if the counter RPC errors — a counting outage must never take ingestion down.
- `resolvePeriod` accepts one-sided from/to (missing from → workspace creation, missing to → now); the `to` day is inclusive.
- `middleware.ts` kept despite Next 16 deprecation warning (rename to `proxy.ts` is a later cleanup, works today).
- Plugin hook queues only on network error / 5xx; 4xx responses are dropped — server-rejected events can never succeed later and would poison the 20-event drain window.
- Hook trigger matching requires a word boundary after `/<trigger>` — plain startsWith would let trigger `report` claim `/report-toolbox` and mis-credit tools.
- `packages/claude-plugin/.mcp.json` ships in the plugin (spec gap) — without it Claude Code never launches the vendored MCP server.
- Plugin tests carry a `test/index.js` shim: Node 24 treats a bare directory arg to `--test` as an entry module.
- Google login button renders only when `NEXT_PUBLIC_AUTH_GOOGLE=true` — self-hosters without an OAuth client never see a broken button.
- Public badge SVG signs "· PositiveROI" (platform brand), not "Multiplier" — the badge vocabulary stays reserved for the builder tier.
- Hosted Supabase migrations were applied via MCP as three combined statements plus 0008; the numbered files in `supabase/migrations/` stay canonical for self-hosters and CI.
- Docs JSON examples are validated against the real zod schemas from `@positiveroi/core` (not hand-written), and Receipt strings in docs are literal `methodologyReceipt()` output.



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
