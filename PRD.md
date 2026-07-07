# PositiveROI Product Requirements

Version 1. This document is the product spec: a PM should be able to rebuild the product from it. The technical companion is [docs/architecture.md](docs/architecture.md).

## Problem

Companies are letting non-engineers build AI tools: automations, Claude Code skills, internal apps, agents. The tools work. The value is invisible. Nobody can answer "what did all this building actually save us?" with a number that survives scrutiny, so the builders get no credit, the initiative gets no budget, and the skeptics win by default.

Existing answers fail in one of two ways. Self-reported spreadsheets inflate until someone laughs at them. Analytics tools count events but say nothing about value. What's missing is a number that is deliberately conservative, traceable to individual runs, and cheap to produce.

## Users

- **Builder** (marketer, sales rep, CS manager who builds tools). Wants: proof their tools matter, visible progress, zero logging overhead. Lands on their personal dashboard.
- **Lead** (team lead or program owner). Wants: who is building, what's working, what's gone quiet. Can edit baselines and manage metrics.
- **Leadership / CFO** (may never log in). Wants: one trustworthy headline number, drillable when challenged. Served by the company dashboard, the read API, and the public impact page.

Workspace roles: `admin` (everything, including keys and settings), `lead` (baseline edits, metrics management), `builder` (register own tools, see everything). Transparency is deliberate: every member can see company-level numbers read-only.

## The core loop

1. A builder registers a tool and answers two honest questions: how many manual minutes did one round take, and does a human decision remain.
2. The tool's runs get captured automatically (four paths below). Each run credits a deliberately undercounted number of minutes.
3. Dashboards turn runs into credited hours, money value, and Multiplier progress. Every number drills down to its runs.
4. The company gets a headline it can publish; the builder gets a badge track worth bragging about. Both point back to step 1: register the next tool.

Time-to-aha target: under 5 minutes from signup to seeing a first (test) run land on the wizard screen.

## The Undercount (methodology)

The full treatment is in [docs/methodology.md](docs/methodology.md). The product rules:

- Baseline: builder's most conservative estimate of manual minutes replaced per run. The UI always nudges toward the lower number.
- **Confidence Cut:** credit 60% of the baseline (×0.6).
- **Judgment Cut:** if a human decision remains, halve it again (×0.5).
- Worked example everywhere: 45 → 27 → 13.5 credited minutes per run.
- Runs are measured; minutes are labeled estimates (`undercounted` tag on every hours figure).
- **The Receipt:** every number opens down to individual runs. Headline → tool → runs table → single run.

Rationale: the number's only job is to survive a skeptical CFO. A conservative number that holds beats an impressive number that collapses. The cuts are fixed product constants, identical in every deployment, so the methodology is citable.

## Capture paths

Four paths, one endpoint (`POST /api/ingest`):

| Tool type | Capture | Source tag |
|---|---|---|
| Automation | HTTP POST per run (curl, webhook step) | `rest` |
| Claude Code skill | Plugin: deterministic prompt hook, zero builder action after setup | `hook` |
| App | `@positiveroi/sdk`, one call | `sdk` |
| Agent | MCP server `log_run` tool | `mcp` |
| (Dashboard) | Manual "log a run" and test runs | `manual` |

Per-source run counts are visible on every tool so a silently failing capture path is noticed ("0 via hook, 12 via mcp"). The hook never sends prompt content, file paths, or environment data; only slug, timestamp, source, an anonymized idempotency key, and a surface marker.

## Screens

Every screen ships with a designed empty state; empty states show the future, not an apology.

| # | Screen | What it does | Empty state |
|---|---|---|---|
| 1 | **Landing** (`/`) | Hero: "Your team is building AI tools. Prove what they're worth." Static dashboard screenshot, scroll-replayed Receipt animation (45 → 27 → 13.5), four capture paths converging on one endpoint, Multiplier ring block, public-page proof block, open-source MIT block, CTA. Self-hosted swaps CTA | n/a (static) |
| 2 | **Methodology** (`/methodology`) | The Undercount standalone: the two cuts, worked example, drill-down guarantee. Linked from every "why do we cut?" expander | n/a (static) |
| 3 | **Pricing** (`/pricing`, hosted only) | Free (up to 5 builders) / Team $29 per month flat / Self-hosted free forever. FAQ: data ownership, after-beta, what counts as a builder | n/a (static) |
| 4 | **Login** (`/login`) | Magic link first; Google OAuth button when configured | n/a |
| 5 | **Onboarding** (`/onboarding`) | One screen: workspace name (slug auto), hourly rate (default $60, explained), your role. Timezone captured silently. Creates workspace + admin membership + seeded metrics + a default ingest key (shown once). Then: skippable invite step → first-tool prompt → the wizard | Is itself the empty state of the product |
| 6 | **Invite accept** (`/invite/[token]`) | Shows workspace name and role, one join button, routes through login if needed | Invalid/expired token: plain explanation, no workspace enumeration |
| 7 | **App shell** (`/w/[slug]`) | Left sidebar: My Impact, Company, Tools, Builders, Metrics, Settings pinned bottom. Top bar: workspace switcher, **global period selector** (week / month / quarter / all-time; every number on screen obeys it), theme toggle. Builders land on My Impact; leads/admins on Company | n/a (chrome) |
| 8 | **Builder dashboard** (`/w/[slug]/me`) | Hero: Hours saved (with `undercounted` tag → Receipt), Runs measured (per-source split on hover), Money (secondary), **Multiplier Ring** (trailing-30d progress toward 180h, tier label in center). My Tools card grid with run sparklines and status chips (`live` / `awaiting first run` / `quiet 14d`). Recent-runs strip (last 10, expandable) | Ring at zero: "your multiplier starts at run one"; dashed "+ Register a tool" card |
| 9 | **Company dashboard** (`/w/[slug]`) | Four drillable stats: Hours saved (`undercounted`), Multiplier equivalent ("2.4 full-time jobs", sub-copy "180 credited hrs/mo = 1 FTE"), Value (admin-only inline rate edit), Runs measured. Hours/week trend, custom-metric tiles, Builders and Tools leaderboards (top 5 + view all), **Gone Quiet** panel (tools with prior runs, none in 14 days; display only). Read-only for builders | Ghosted sample-watermarked tiles until first real run |
| 10 | **Tools directory** (`/w/[slug]/tools`) | All tools: name, type, owner, credited min/run, runs, hours, status. Archived tools filtered by default | Explainer + register CTA |
| 11 | **Registration wizard** (`/w/[slug]/tools/new`) | 4 steps, one decision each, live **Receipt panel** animating alongside: (1) What is it: name, description, owner, four type cards ("type only changes setup instructions, not the math"). (2) Baseline: "Before this tool, how many minutes did one round take by hand?" Stepper + presets 5/15/30/60/120, "take the lower one" nudge, soft warning above 240, hard cap 480. (3) The Cuts: Receipt animates 45 → −40% → 27 → judgment yes/no → ÷2 → 13.5, closing line "When someone challenges this number, it wins", link to methodology. (4) Capture: type-specific snippet with tool id + key inlined, live "Waiting for your first run…" listener (3s poll), **Send a test run** button (real ingestion, `is_test`, "not counted" chip), **Log a run manually**, skip option | The wizard is the empty state; the live listener is the aha |
| 12 | **Tool detail** (`/w/[slug]/tools/[id]`) | Tabs: **Overview** (Receipt, per-source run counts), **Runs** (paginated; test runs labeled; manual runs attributed "added by X"; baseline-change markers), **Setup** (the Connect snippets), **Settings** (baseline edit for lead/admin, re-runs Receipt, audited; archive) | Overview shows the live listener until run #1; Runs: "no runs in this period — 214 all-time" with period-widen action |
| 13 | **Builders leaderboard** (`/w/[slug]/builders`) | Ranked list: hours, runs, tools, tier, Multiplier laurels. Departed members shown as "former member". No profile pages in v1 | Invite CTA |
| 14 | **Metrics** (`/w/[slug]/metrics`) | Custom metric definitions (seeded: revenue influenced, leads generated, client touchpoints), totals per period, drill to contributing events. Lead/admin: create/edit/delete (delete confirms with affected-value count) | Seeded metrics at zero with a how-to link |
| 15 | **Settings: general** | Workspace name, hourly rate, currency, timezone; plan section: "Free while in beta — contact to upgrade" | n/a |
| 16 | **Settings: members** | Member list with roles; link invites: create (role, max uses, 14-day expiry), copy, revoke, use counts | Single-member explainer + invite CTA |
| 17 | **Settings: keys** | Create/revoke keys, scope (ingest/read), prefix display, `last_used_at` ("never used" is the #1 onboarding debug signal). Plaintext shown once at creation | Explainer: what keys are for, which scope to pick |
| 18 | **Settings: public** | Enable toggle, public slug, show_tools / show_builders / show_money toggles, live preview of the real page behind a "not published" scrim, badge embed code | Preview renders with current data even while disabled |
| 19 | **Public impact page** (`/p/[slug]`) | "Acme's builders saved 340 hours this quarter" + `undercounted` tag with inline explainer, trend sparkline, runs / active builders / Multipliers earned (config-gated), optional top tools (names + hours only). Footer: "Counted with PositiveROI — the Undercount methodology" (links to landing; not removable on hosted free tier). Disabled or unknown slug: plain 404 | Enabled with no data: headline at zero, methodology intact |
| 20 | **SVG badge** (`/badge/[slug]`) | Embeddable flat SVG (~240×54), light/dark themes, "340 hrs saved this quarter", links to the public page. Cached ~1h | Zero-hours variant renders honestly |
| 21 | **Admin stub** (`/admin`, hosted only) | Bare table for the operator: workspace, builders, events, created date. Gated to `HOSTED_ADMIN_EMAILS`; 404 on self-hosted | Empty table |

## Multiplier badge and display tiers

One rule: **180 credited hours in the trailing 30 days = one full-time job = Multiplier.** The window rolls; the ring decays honestly; nothing resets on a calendar boundary.

| Tier | Threshold (trailing-30d credited hours) |
|---|---|
| First Run | any hours, at least 1 run |
| Saver | 9 |
| Operator | 45 |
| Heavy Lifter | 90 |
| **Multiplier** | **180** |
| Multiplier ×2 | 360 |
| Multiplier ×3 | 540 |

Only **Multiplier** is a stored, permanent award ("first earned March 2026" persists even if the trailing rate drops). All other tiers, including ×2/×3, are display-only labels computed from the same number. Awards happen lazily whenever progress is computed; celebration in v1 is a toast plus a company-dashboard mention ("Dana became a Multiplier"). Every badge and tier click opens the Receipt for the qualifying 30 days. Attribution is by tool owner.

## Custom metrics

Time saved is the floor, not the ceiling. Workspaces define metrics (key, name, unit: currency / count / duration); every workspace starts with revenue influenced, leads generated, client touchpoints. Values ride on runs via the ingest `metrics` map, and only that way; the dashboard's manual-log form uses the same path. Unknown keys never fail a run (accepted with a warning). Rollups sum per metric per period, exclude test runs, and drill to contributing events.

## Credibility rules (non-negotiable)

1. **Test runs never touch a headline number.** `is_test` events are excluded from every aggregate, leaderboard, badge computation, and public surface. Visible and labeled in drill-downs; purgeable.
2. **Overrides only lower credit.** A run's `minutes_saved` override clamps to `[0, baseline]`. No API path can inflate a run above the registered baseline.
3. **Baselines are bounded and audited.** Dashboard cap 480 raw minutes (soft warning at 240); API-registered tools capped at 120 and stamped for review. Every baseline set or change records who/when/old/new; edits are lead/admin only; changes appear as markers in the runs history.
4. **Every number is a door.** Two clicks maximum from any headline to the runs that produced it.
5. **Honest vocabulary.** Runs are "measured"; hours carry the `undercounted` tag; the framing is "measured runs × credited minutes."

## Business model

- **Open source (MIT).** Full platform self-hostable from the public repo. No telemetry in self-hosted deployments; stated in the README as a trust signal.
- **Hosted (free beta).** Pricing page copy: Free up to 5 builders; Team $29/month flat, unlimited builders + API. No billing enforcement in v1; upgrades are "contact us." The limit is copy, not code, during beta.
- The hosted footer on public pages ("Counted with PositiveROI") is the growth loop: every published impact page advertises the methodology.

## v1 cut-line (deferred to v1.1+)

- Email invites and a transactional email provider (v1 is link invites only)
- Stripe billing and free-tier enforcement (pricing is copy-only)
- npm publishing of core/sdk/mcp-server (plugin ships a vendored MCP bundle; Changesets flow is pre-configured but disabled)
- Supabase Realtime live updates (v1 polls: 3s on the wizard listener, 5s on recent runs)
- Anomaly flags ("412 runs in one hour — review?") and cross-source duplicate surfacing
- Materialized rollups / `pg_cron` (on-the-fly SQL is fine below ~1M events/year)
- Gone Quiet nudge actions, builder profile pages, stored tier ladder, full-screen badge celebration
- Public per-run drill-down endpoint (Receipt is dashboard-internal)
- Demo workspace, org SSO, per-user workspace-creation caps
