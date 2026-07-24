# PositiveROI — Architecture (v1)

This is the founding architecture document, synthesized before the build; the product ships at a .vercel.app URL first, with positiveroi.dev to follow.

Product name: **PositiveROI** (npm scope `@positiveroi`, key prefixes `roi_ingest_` / `roi_read_`, config dir `~/.positiveroi/`). All name-derived strings come from one constant in `packages/core`. Decision Zero (the name) is **resolved: PositiveROI**. The original draft used the placeholder name "Multiplier" for the platform; "Multiplier" survives below only as badge/tier vocabulary (the 180-hour badge, the Multiplier Ring).

---

## 1. Architecture summary

One Next.js App Router app on Vercel serves the dashboard, the public pages, and every API route. One Supabase Postgres holds everything; no queues, no cron, no edge functions. Two auth planes that never mix: humans via Supabase Auth (Google OAuth primary, magic link best-effort) with RLS as the *read* boundary; machines via hashed API keys verified in route handlers running the service-role client. **All writes go through server actions/route handlers behind one `requireMember` guard — RLS grants SELECT only.** All four capture paths (REST, SDK, MCP, Claude Code hook) converge on `POST /api/ingest` with tool-scoped idempotency and server-side clamping. The methodology (raw × 0.6, × 0.5 if high-judgment) lives once as a Postgres generated column, mirrored by one tested TypeScript function in `packages/core`. Aggregates are on-the-fly SQL over indexed ranges; badge awards are lazy on read; rate limiting is a self-cleaning upsert table. Multiplier = 180 credited hours in a **trailing 30 days**. The MCP server is **vendored into the plugin** as a bundled file — npm publishing is off the critical path. Public page and SVG badge are cached reads behind a single tested gate function.

## Decision log (conflicts resolved, one line each)

| # | Conflict | Decision |
|---|---|---|
| 1 | Ingest path (3 variants) | `POST /api/ingest`, accepts a single event or `{events:[...]}` batch |
| 2 | Read API path | `/api/v1/stats\|tools\|timeseries\|metrics\|summary` |
| 3 | IA depth | D1's `/w/[slug]` prefix + D3's flatter page set; cut builder profiles, `/account`, `/settings/plan`, in-app docs |
| 4 | Multiplier window | Trailing 30 days everywhere; calendar-month machinery, `monthBoundsUtc`, and DST test matrix deleted |
| 5 | Badge storage | Only `multiplier` stored (permanent); all tiers and ×2/×3 are display-only labels from the same trailing-30d number |
| 6 | Idempotency scope | Tool-scoped: `unique (tool_id, idempotency_key)`; key formats pinned in `core` + shared fixture test |
| 7 | Hook+MCP double-count | No server-side time-window dedup; plugin config marks hook-captured tools, `log_run` refuses them, per-source counts make failures visible |
| 8 | `source` field | In the zod schema, optional, default `rest`; `manual` rejected from API keys (dashboard-internal only) |
| 9 | Key prefix / naming | `roi_ingest_` / `roi_read_`; Decision Zero resolved (name = PositiveROI) |
| 10 | Migration order | `api_keys` migrates before `events` (FK fix) |
| 11 | Test/sample runs | Cut the auto-created sample tool; keep D1's test-run button **with** an `is_test` column excluded from every aggregate |
| 12 | Hourly rate / cache | Default $60 (6000 cents); public page `revalidate 300`, badge `s-maxage 3600` |
| 13 | Manual runs | No RLS insert policies; manual logs and test runs go through the same server ingest function (`source: manual`, `created_by` set) |
| 14 | Baseline edits | Lead/admin only, recorded in a bare `baseline_history` table (who/when/old/new, no reason field) |
| 15 | Dashboard data layer | Server components call `lib/aggregates.ts` on service role behind `requireMember`; browser never queries Postgres directly |
| 16 | Invites | Link-only in v1: multi-use with `max_uses`, revocable, 14-day expiry; email invites deferred |
| 17 | Tool status | `active \| archived` only; "awaiting first run" and "gone quiet" are derived, never stored |

**Critique dispositions — rejected or modified (why, one line each):**

- **C1-H2 (fully disjoint scopes): modified.** Ingest keys additionally get `GET /api/v1/summary` (runs/hours/tool count only — no money, no breakdowns, no timeseries) and a slim tool list, because the setup skill's live verification and the "you're at 61%" moment are core UX; leak surface is roughly what a public page shows.
- **C1-H3 (no tool creation on ingest keys): modified.** Kept for the flagship `register_tool` skill, but API-created tools are hard-capped at 120 raw minutes, stamped `origin='api'`, audited, and listed on the admin dashboard for review.
- **C1-H1 (approval workflow above threshold): modified.** No approval workflow in v1; hard caps (480 dashboard / 120 API) + audit trail + admin outlier list deliver the substance without a workflow engine.
- **C2 "cut the baseline audit trail": partially rejected.** C1-H4 is high severity and per-event snapshots don't show *who* changed the baseline; a bare who/when/old/new table is ~15 minutes of build.
- **C2 "test run needs no flag": rejected.** C1-M3 stands — a skeptic finding test data inside "measured runs" destroys the product's one promise; `is_test` is one boolean.
- Everything else in both critiques: **accepted** (disjoint read scope for full stats, invite hardening, no manual RLS inserts, metric-value workspace consistency, hook exfiltration rules, no SECURITY DEFINER RPCs, CORS, vendored MCP, app-layer time bounds, cut list as specified).

Product vocabulary from Design 1 is adopted wholesale: **Baseline → Confidence Cut (−40%) → Judgment Cut (÷2) → Credited Time**; a logged event is a **Run**; the drilldown is **the Receipt**; headline framing is always **"measured runs × credited minutes"** with an `undercounted` tag.

---

## 2. Monorepo layout

```
positiveroi/
├── .claude-plugin/
│   └── marketplace.json                # repo = plugin marketplace
├── apps/
│   └── web/
│       ├── package.json  next.config.ts  tailwind.config.ts  components.json
│       ├── src/
│       │   ├── app/
│       │   │   ├── (marketing)/
│       │   │   │   ├── page.tsx                    # landing (static hero screenshot)
│       │   │   │   ├── pricing/page.tsx            # hosted only (flag)
│       │   │   │   └── methodology/page.tsx        # the Undercount, standalone
│       │   │   ├── (auth)/
│       │   │   │   ├── login/page.tsx
│       │   │   │   ├── auth/callback/route.ts
│       │   │   │   ├── invite/[token]/page.tsx
│       │   │   │   └── onboarding/page.tsx
│       │   │   ├── w/[slug]/                       # authed app shell
│       │   │   │   ├── layout.tsx                  # nav, workspace switcher, period selector, theme
│       │   │   │   ├── page.tsx                    # company dashboard
│       │   │   │   ├── me/page.tsx                 # builder dashboard
│       │   │   │   ├── tools/page.tsx
│       │   │   │   ├── tools/new/page.tsx          # 4-step wizard + Receipt
│       │   │   │   ├── tools/[id]/page.tsx         # tabs: overview | runs | setup | settings
│       │   │   │   ├── builders/page.tsx           # leaderboard list (no profiles)
│       │   │   │   ├── metrics/page.tsx
│       │   │   │   └── settings/
│       │   │   │       ├── page.tsx                # general + plan section
│       │   │   │       ├── members/page.tsx        # members + link invites
│       │   │   │       ├── keys/page.tsx
│       │   │   │       └── public/page.tsx
│       │   │   ├── admin/page.tsx                  # hosted lead-gen stub (HOSTED_ADMIN_EMAILS)
│       │   │   ├── p/[slug]/page.tsx               # public impact page (ISR 300s)
│       │   │   ├── badge/[slug]/route.ts           # SVG badge (strips optional .svg suffix)
│       │   │   └── api/
│       │   │       ├── ingest/route.ts             # THE ingestion endpoint (+ OPTIONS/CORS)
│       │   │       └── v1/
│       │   │           ├── stats/route.ts
│       │   │           ├── tools/route.ts          # GET (slim/full by scope) + POST (register)
│       │   │           ├── timeseries/route.ts
│       │   │           ├── metrics/route.ts
│       │   │           └── summary/route.ts        # ingest-scope-safe aggregate
│       │   ├── lib/
│       │   │   ├── supabase/{server.ts, client.ts, admin.ts}   # admin.ts imports 'server-only'
│       │   │   ├── guards.ts            # requireUser / requireMember(workspaceId, minRole)
│       │   │   ├── api-keys.ts          # generate, sha256 verify, scope check, throttled last_used
│       │   │   ├── ingest-core.ts       # pure fn: (keyCtx|memberCtx, payload) -> results  ← frozen first
│       │   │   ├── aggregates.ts        # all rollup SQL (always filters is_test = false)
│       │   │   ├── badges.ts            # lazy Multiplier award
│       │   │   ├── public-gate.ts       # getPublicWorkspace(slug) — the ONE anon gate
│       │   │   ├── rate-limit.ts
│       │   │   └── flags.ts             # only file reading NEXT_PUBLIC_DEPLOYMENT
│       │   ├── actions/                 # server actions: workspace, tools, invites, keys, metrics, manual-log
│       │   └── components/              # ui/ (shadcn) + product components (Receipt, Ring, StatTile…)
│       └── __tests__/                   # vitest: ingest-core, clamps, aggregates, key auth, public gate
├── packages/
│   ├── core/                            # @positiveroi/core
│   │   └── src/{constants.ts, methodology.ts, schemas.ts, idempotency.ts, snippets.ts, index.ts}
│   ├── sdk/                             # @positiveroi/sdk — ~40-line fetch wrapper, no queue
│   │   └── src/{client.ts, index.ts}
│   ├── mcp-server/                      # @positiveroi/mcp-server — esbuild single-file bundle
│   │   └── src/{cli.ts, config.ts, tools/{log-run,register-tool,list-tools,get-summary}.ts}
│   └── claude-plugin/                   # NOT npm-published; installed via repo marketplace
│       ├── .claude-plugin/plugin.json
│       ├── hooks/{hooks.json, capture.mjs}
│       ├── mcp/server.mjs               # VENDORED build output of packages/mcp-server
│       ├── .mcp.json                    # runs node ${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs
│       ├── skills/{impact-setup/SKILL.md, register-tool/SKILL.md}
│       └── README.md
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 0001_types.sql  0002_workspaces_members_invites.sql  0003_api_keys.sql
│       ├── 0004_tools.sql  0005_events_metrics.sql  0006_badges_rate_limits.sql  0007_rls.sql
├── docs/                                # methodology, quickstart/{automation,skill-plugin,app,agent},
│                                        # api/{ingestion,read-api}, mcp-server, sdk, self-hosting, architecture
├── scripts/{setup.mjs, seed-demo.mjs, bundle-plugin-mcp.mjs}
├── .github/workflows/{ci.yml, release.yml}    # release configured, publish deferred
├── .changeset/config.json  turbo.json  pnpm-workspace.yaml  package.json
├── .env.example  LICENSE (MIT)  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md  README.md
```

---

## 3. Database schema (final DDL)

```sql
-- ===== 0001_types.sql =====
create extension if not exists pgcrypto;
create schema if not exists app;

create type member_role   as enum ('admin','lead','builder');
create type tool_type     as enum ('automation','skill','agent','app');
create type tool_status   as enum ('active','archived');
create type event_source  as enum ('rest','mcp','hook','sdk','manual');
create type metric_unit   as enum ('currency','count','duration');
create type api_key_scope as enum ('ingest','read');
create type badge_type    as enum ('multiplier');

-- ===== 0002_workspaces_members_invites.sql =====
create table workspaces (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 80),
  slug              text not null unique
                      check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  timezone          text not null default 'UTC',
  hourly_rate_cents integer not null default 6000 check (hourly_rate_cents between 0 and 100000000),
  currency          char(3) not null default 'USD',
  public_enabled    boolean not null default false,
  public_slug       text unique
                      check (public_slug is null or public_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  public_config     jsonb not null default '{"show_tools": true, "show_builders": false, "show_money": false}',
  created_at        timestamptz not null default now()
);

create function app.assert_valid_tz() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform now() at time zone new.timezone;   -- raises on invalid IANA name
  return new;
end $$;
create trigger workspaces_tz_check before insert or update of timezone
  on workspaces for each row execute function app.assert_valid_tz();

create table members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'builder',
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_user_idx on members (user_id);

-- v1: link invites only (email column parked for v1.1 email invites)
create table invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text,                          -- always null in v1
  role         member_role not null default 'builder',
  token_hash   text not null unique,          -- sha256 of the invite token
  max_uses     integer not null default 25 check (max_uses between 1 and 500),
  use_count    integer not null default 0,
  created_by   uuid not null references auth.users(id),
  expires_at   timestamptz not null default now() + interval '14 days',
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index invites_ws_idx on invites (workspace_id);

-- ===== 0003_api_keys.sql =====  (before events: FK ordering fix)
create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null default '',
  scope        api_key_scope not null,
  key_prefix   text not null,                 -- 'roi_ingest_3fk2' — display only
  key_hash     text not null unique,          -- sha256 hex of full secret
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index api_keys_ws_idx on api_keys (workspace_id);

-- ===== 0004_tools.sql =====
create table tools (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  owner_id              uuid not null references auth.users(id),
  name                  text not null check (char_length(name) between 1 and 100),
  slug                  text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$'),
  description           text not null default '',
  type                  tool_type not null,
  status                tool_status not null default 'active',
  origin                text not null default 'dashboard' check (origin in ('dashboard','api')),
  raw_estimate_minutes  numeric(8,2) not null
                          check (raw_estimate_minutes > 0 and raw_estimate_minutes <= 480),
  high_judgment         boolean not null default false,
  minutes_saved_per_run numeric(8,2) generated always as (
      round(raw_estimate_minutes * 0.6
            * case when high_judgment then 0.5 else 1.0 end, 2)
  ) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index tools_ws_idx    on tools (workspace_id, status);
create index tools_owner_idx on tools (workspace_id, owner_id);

-- bare audit: who set/changed the baseline, when (C1-H4)
create table baseline_history (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  tool_id           uuid not null references tools(id) on delete cascade,
  changed_by        uuid references auth.users(id),
  old_raw_estimate  numeric(8,2),              -- null on creation row
  new_raw_estimate  numeric(8,2) not null,
  old_high_judgment boolean,
  new_high_judgment boolean not null,
  changed_at        timestamptz not null default now()
);
create index baseline_history_tool_idx on baseline_history (tool_id, changed_at desc);

-- ===== 0005_events_metrics.sql =====
create table events (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  tool_id            uuid not null references tools(id) on delete cascade,
  occurred_at        timestamptz not null default now(),   -- bounds enforced in app layer
  received_at        timestamptz not null default now(),
  source             event_source not null default 'rest',
  is_test            boolean not null default false,       -- excluded from every aggregate
  minutes_saved      numeric(8,2) not null check (minutes_saved >= 0 and minutes_saved <= 480),
  minutes_overridden boolean not null default false,
  idempotency_key    text check (char_length(idempotency_key) <= 128),
  metadata           jsonb not null default '{}' check (pg_column_size(metadata) <= 8192),
  api_key_id         uuid references api_keys(id) on delete set null,
  created_by         uuid references auth.users(id)        -- set for source = 'manual'
);
create unique index events_idem_uq on events (tool_id, idempotency_key)
  where idempotency_key is not null;
create index events_ws_time_idx   on events (workspace_id, occurred_at desc) where is_test = false;
create index events_tool_time_idx on events (tool_id, occurred_at desc);

create table metric_definitions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name         text not null,
  unit         metric_unit not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, key)
);
-- seeded at workspace creation (server action): revenue_influenced (currency),
-- leads_generated (count), client_touchpoints (count)

create table metric_values (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id     uuid not null references events(id) on delete cascade,
  metric_id    uuid not null references metric_definitions(id) on delete cascade,
  occurred_at  timestamptz not null,
  value        numeric(14,2) not null,
  unique (event_id, metric_id)
);
create index metric_values_rollup_idx on metric_values (workspace_id, metric_id, occurred_at desc);

-- workspace-consistency trigger (C1-M1, defense in depth behind the server path)
create function app.assert_mv_consistent() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from events e
                 where e.id = new.event_id and e.workspace_id = new.workspace_id)
  or not exists (select 1 from metric_definitions md
                 where md.id = new.metric_id and md.workspace_id = new.workspace_id) then
    raise exception 'metric value crosses workspace boundary';
  end if;
  return new;
end $$;
create trigger metric_values_consistency before insert or update on metric_values
  for each row execute function app.assert_mv_consistent();

-- ===== 0006_badges_rate_limits.sql =====
create table builder_badges (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  badge        badge_type not null,
  earned_at    timestamptz not null default now(),   -- permanent once earned
  primary key (workspace_id, user_id, badge)
);

create table rate_limits (
  api_key_id   uuid not null references api_keys(id) on delete cascade,
  window_start timestamptz not null,                 -- minute-truncated
  count        integer not null default 1,
  primary key (api_key_id, window_start)
);

-- ===== 0007_rls.sql =====
create function app.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (select 1 from members where workspace_id = ws and user_id = auth.uid()) $$;

create function app.member_role(ws uuid) returns member_role
language sql stable security definer set search_path = public, pg_temp as
$$ select role from members where workspace_id = ws and user_id = auth.uid() $$;

alter table workspaces         enable row level security;
alter table members            enable row level security;
alter table invites            enable row level security;
alter table api_keys           enable row level security;
alter table tools              enable row level security;
alter table baseline_history   enable row level security;
alter table events             enable row level security;
alter table metric_definitions enable row level security;
alter table metric_values      enable row level security;
alter table builder_badges     enable row level security;
alter table rate_limits        enable row level security;   -- no policies: service-role only

-- RLS is the READ boundary. There are deliberately NO insert/update/delete
-- policies for `authenticated`: every mutation goes through server actions /
-- route handlers using the service-role client behind requireMember().
create policy ws_select    on workspaces         for select to authenticated using (app.is_member(id));
create policy mem_select   on members            for select to authenticated using (app.is_member(workspace_id));
create policy inv_select   on invites            for select to authenticated using (app.member_role(workspace_id) = 'admin');
create policy key_select   on api_keys           for select to authenticated using (app.member_role(workspace_id) = 'admin');
create policy tool_select  on tools              for select to authenticated using (app.is_member(workspace_id));
create policy bh_select    on baseline_history   for select to authenticated using (app.is_member(workspace_id));
create policy ev_select    on events             for select to authenticated using (app.is_member(workspace_id));
create policy md_select    on metric_definitions for select to authenticated using (app.is_member(workspace_id));
create policy mv_select    on metric_values      for select to authenticated using (app.is_member(workspace_id));
create policy badge_select on builder_badges     for select to authenticated using (app.is_member(workspace_id));
-- anon role: zero policies anywhere. Public pages read via service role
-- through lib/public-gate.ts only.
```

Server-enforced rules that intentionally live in app code, not DDL: `occurred_at` bounds (reject > now+5min or > 90 days past on the API path; dashboard manual log has no lower bound), API tool-creation cap (`raw_estimate_minutes <= 120` when `origin='api'`), override clamp (`minutes_saved` override clamped to `[0, tool.raw_estimate_minutes]` — may only lower credit), baseline edits restricted to lead/admin + `baseline_history` row, `source='manual'` rejected from API keys.

---

## 4. API contract

All errors: `{ "error": { "code": "...", "message": "..." } }`. Codes: `unauthorized` 401, `forbidden_scope` 403, `not_found` 404, `payload_too_large` 413, `validation_failed` 422 (+`error.details[]`), `rate_limited` 429 (+`Retry-After`), `internal` 500. Rate limit: 120 req/min/key via the `rate_limits` upsert; ~1% of requests opportunistically delete windows older than 1 hour. CORS on `/api/ingest` and `/api/v1/*`: handle `OPTIONS`, `Access-Control-Allow-Origin: *`, allow `Authorization, Content-Type`.

### Ingest — scope `ingest`

**`POST /api/ingest`** — accepts one bare event object or a batch (1–100 events, body ≤ 256 KB):

```json
{ "events": [ {
    "tool": "weekly-pipeline-digest",          // slug or uuid, required
    "occurred_at": "2026-07-07T09:15:00Z",     // optional, default now; bounds enforced
    "source": "hook",                          // optional: rest|mcp|hook|sdk (default rest; manual rejected)
    "idempotency_key": "trg:run_8f2k1",        // optional, <=128 chars, scoped per tool
    "minutes_saved": 12,                       // optional override, clamped [0, raw_estimate]
    "is_test": false,                          // optional; test runs never count in aggregates
    "metadata": { "records": 42 },             // optional, <=8KB
    "metrics": { "leads_generated": 3 }        // optional, by metric key
} ] }
```

`200`:

```json
{ "results": [
    { "status": "accepted",  "event_id": "uuid",
      "warnings": ["unknown_metric:foo"],                       // event still accepted (C2-C.8)
      "tool_totals": { "tool": "weekly-pipeline-digest",
                       "owner_hours_30d": 112.5,
                       "multiplier_progress": 0.62 } },
    { "status": "duplicate", "event_id": "uuid" },
    { "status": "rejected",  "error": { "code": "unknown_tool", "message": "..." } }
  ],
  "accepted": 1, "duplicates": 1, "rejected": 1 }
```

Duplicates are silent no-ops (`insert ... on conflict do nothing`); whole-batch retries are always safe. `tool_totals` is what lets the MCP server narrate multiplier progress **without any read access**.

**`POST /api/v1/tools`** — register a tool (used by MCP `register_tool`):

```json
{ "name": "Weekly pipeline digest", "type": "automation", "description": "...",
  "raw_estimate_minutes": 45, "high_judgment": false }
```

Rules: `raw_estimate_minutes <= 120` on this path (hard 422 above); owner = key creator; `origin='api'`; creation row written to `baseline_history`. `201`: `{ "tool": { "id", "slug", "minutes_saved_per_run": 27.0, "methodology": "45 min raw x 0.6 conservatism = 27.0 credited min/run" } }`. `409 slug_taken` returns the existing tool's id/slug so the client can suggest `log_run` instead.

**`GET /api/v1/tools`** — allowed to both scopes. Ingest scope gets the **slim** shape (`id, slug, name, type, status, minutes_saved_per_run`); read scope gets full (`+ owner, runs_30d, hours_all_time, last_run_at`).

**`GET /api/v1/summary`** — allowed to both scopes (the deliberate narrow window for ingest keys): `{ "workspace": "acme", "runs_30d": 1843, "hours_30d": 412.7, "active_tools": 14, "builders": 6 }`. No money, no per-builder breakdown, no timeseries.

### Read — scope `read` only

- **`GET /api/v1/stats?period=week|month|quarter`** or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (dates in workspace TZ; omit = all-time) → `{ range, runs, minutes_saved, hours_saved, fte_equivalent, money_value: {amount, currency, hourly_rate} | null (no rate set), active_tools, builders, methodology: "measured runs x conservative estimated minutes per run" }`. FTE = `hours / (180 * period_days / 30.44)`.
- **`GET /api/v1/timeseries?bucket=day|week|month&from&to&tool={slug}&metric={key}`** → `{ "buckets": [ { "start", "runs", "minutes_saved", "metric_value" } ] }` (bucketed in workspace TZ).
- **`GET /api/v1/metrics?from&to`** → totals per metric definition.

Read responses: `Cache-Control: private, max-age=60`. All aggregate queries filter `is_test = false`. The per-tool runs drilldown is dashboard-internal (server components), not a public endpoint.

---

## 5. MCP server tools

Package `@positiveroi/mcp-server`, stdio transport. Config: `~/.positiveroi/config.json` (`endpoint`, `apiKey` [ingest scope], `tools` trigger→slug map, `hookCaptured` slug list); env overrides `POSITIVEROI_API_KEY` / `POSITIVEROI_ENDPOINT`. Runnable as `npx -y @positiveroi/mcp-server` post-launch, but **v1 ships vendored inside the plugin** (see §6) so npm is not a launch gate. All validation delegates to `@positiveroi/core` schemas.

1. **`register_tool`** — "Register a new tool so its runs count toward impact. Uses the conservative time-saved methodology." Params: `name` (req), `type` (req), `description`, `raw_estimate_minutes` (req — "the most conservative estimate of manual minutes one run replaces; max 120 via this path"), `high_judgment` (req — "does a human still make a meaningful decision in this task?"). Calls `POST /api/v1/tools`; returns the computed credit **with the methodology string** so the model shows the builder exactly how the number was derived. On `409` returns the existing tool and suggests `log_run`.
2. **`log_run`** — "Log one run of a registered tool after its work completes." Params: `tool` (req, slug or name; exact-slug resolution first), `minutes_saved` (optional — "only to lower credit for a partial run"), `metadata`, `metrics` (key→number map), `idempotency_key` (optional — "reuse the same value on retry"), `force` (optional boolean). **If the tool slug is in the config's `hookCaptured` list, refuse with "this tool's runs are logged automatically by the hook" unless `force: true`** (client-side double-count guard; the tool-scoped idempotency index is the server backstop). Calls `POST /api/ingest`; returns `{status, owner_hours_30d, multiplier_progress}` from `tool_totals` so the model can say "logged — you're at 62% of your Multiplier badge."
3. **`list_tools`** — resolves slugs for the model; calls `GET /api/v1/tools` (slim).
4. **`get_summary`** — "How much impact has this workspace measured?" Calls `GET /api/v1/summary`. Description notes that full stats/money/timeseries require a read-scoped key in the dashboard's Read API.

---

## 6. Claude Code plugin template

**`plugin.json`**: minimal manifest (name `positiveroi`, version, description, author). Hooks, skills, `.mcp.json` auto-load from default locations.

**`hooks/hooks.json`**: one `UserPromptSubmit` hook → `node "${CLAUDE_PLUGIN_ROOT}/hooks/capture.mjs"`, timeout 5.

**`hooks/capture.mjs` behavior spec (exact):**
1. Read hook JSON from stdin (`prompt`, `session_id`).
2. Load `~/.positiveroi/config.json`; env vars override. **No config or no trigger match → `exit 0` immediately** (invisible when unconfigured).
3. On match, POST to `{endpoint}/api/ingest` (3s fetch timeout) with **only**: `tool` slug, `occurred_at`, `source: "hook"`, `idempotency_key: "hook:" + session_id + ":" + sha256(prompt).slice(0,16)`, `metadata: { "surface": "claude-code" }`.
4. **Hard exfiltration rules (load-bearing, see §10):** never send prompt text or any substring, skill arguments, file paths, cwd, or env values; never write to stdout (stdout is injected into model context); never exit non-zero; never block the prompt.
5. On any failure, append the event to `~/.positiveroi/queue.ndjson` and exit 0. Each invocation first drains up to 20 queued events (idempotency makes replays safe). Queue capped at 1 MB, oldest dropped. Queue rows are safe on disk precisely because rule 4 keeps prompt content out of events.
6. The idempotency format is pinned by a shared test fixture against `core/idempotency.ts` (the hook cannot import core — the fixture keeps them identical).

**`.mcp.json`** (vendored, no npm dependency at install time):

```json
{ "mcpServers": { "positiveroi": {
    "command": "node",
    "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs"] } } }
```

`scripts/bundle-plugin-mcp.mjs` esbuilds `packages/mcp-server` into `packages/claude-plugin/mcp/server.mjs` on every build. `${CLAUDE_PLUGIN_ROOT}` expansion is verified in the plugin track's first hour.

**Skills:**
- **`impact-setup`** — triggers on "set up positiveroi / connect impact tracking." Walks: open dashboard → Settings → API Keys → create ingest key → paste here. Writes `~/.positiveroi/config.json`, then calls `get_summary` as live verification ("Connected — your workspace has 3 tools and 41 hours measured"). Evidence, not "should work."
- **`register-tool`** — the guided methodology interview in chat: what does the tool do → conservative manual minutes ("if unsure between two numbers, take the lower") → does a human judgment call remain? Shows the Receipt math aloud ("45 min x 0.6 x 0.5 = 13.5 credited min/run — deliberately low so nobody can argue with it"), calls MCP `register_tool`, then appends the trigger→slug mapping to config **and adds the slug to `hookCaptured`** so hook capture starts and `log_run` won't double-log. Ends by telling the builder where the number will appear.

**Distribution** (printed verbatim in the dashboard's Connect panel):

```
/plugin marketplace add stavcharkham/positiveroi
/plugin install positiveroi@positiveroi
```

---

## 7. Web app routes/IA + key screen specs

Navigation: left sidebar — My Impact, Company, Tools, Builders, Metrics; Settings pinned bottom. Top bar: workspace switcher, **global period selector** (last 7 / 30 / 90 days / custom from-to range / all-time — every number on screen obeys it; the dashboard packs a custom range into the same `?period=` param as `from..to`), theme toggle. Builders land on `/w/[slug]/me`; leads/admins on `/w/[slug]`. Middleware redirects authed users with zero workspaces to `/onboarding`.

**Onboarding** (`/onboarding`): one screen, 3 fields — workspace name (slug auto), hourly rate (default $60, "used to convert hours to money, changeable anytime"), your role. Timezone captured silently from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Creation server action atomically creates workspace + admin member + seeded metric definitions + **a default ingest key** (plaintext shown once in wizard step 4). Then: skippable invite-link step → full-screen first-tool prompt → the wizard. Time-to-aha target: under 5 minutes with a test run.

**Registration wizard** (`/w/[slug]/tools/new`) — 4 steps, one decision each, live **Receipt** panel (right side / bottom sheet):
1. *What is it* — name, description, owner, four type cards (type only changes setup instructions, "not the math").
2. *Baseline* — "Before this tool, how many minutes did one round take by hand?" Minute stepper + presets (5/15/30/60/120); nudge: "unsure between two numbers? take the lower one"; soft warning above 240; hard cap 480.
3. *The Cuts* — the Receipt animates: Baseline 45 → **Confidence Cut** −40% → 27 → **Judgment Cut?** (Yes/No with examples) → ÷2 → **Credited Time 13.5 min/run**. Closing line: "Your tool gets credit for 13.5 of the 45 minutes you claimed. When someone challenges this number, it wins." "Why do we cut?" expander → `/methodology`.
4. *Capture* — type-specific snippet with the tool id and the ingest key inlined (snippets rendered from `core/snippets.ts`, same source as docs). Footer on all variants: live "Waiting for your first run…" (3s polling, no Realtime) + **Send a test run** (fires real ingestion with `is_test: true`, renders the Receipt with a "test — not counted in totals" chip) + **Log a run manually** (real, counted, attributed) + "Skip — finish setup later." Aha = the first event arriving in place, receipt stamping in, counter ticking up.

**Builder dashboard** (`/w/[slug]/me`): hero — Hours saved (huge, with persistent **`undercounted`** tag → opens Receipt breakdown), Runs measured (per-source split on hover), Money (secondary), **Multiplier Ring** (radial trailing-30d progress toward 180h, tier label in center, "112h / 180h — 62% of a full-time job"). Then: My Tools card grid (name, type, credited min/run, run sparkline, hours, status chip `live` / `awaiting first run` / `quiet 14d` — derived), dashed "+ Register a tool" card. Recent-runs strip (last 10, 5s polling, rows expand to full event). Drill path: headline → per-tool → runs table → run receipt, always two clicks.

**Company dashboard** (`/w/[slug]`): four drillable headline stats — Hours saved (`undercounted` tag), Multiplier equivalent ("2.4 full-time jobs", sub-copy "180 credited hrs/mo = 1 FTE"), Value (admin-only inline rate edit), Runs measured. Hours/week trend chart; custom-metric tiles; two leaderboards (Builders, Tools — top 5 + view all; owner via left join, departed members shown as "former member"); **Gone Quiet** panel (display-only, no nudge action: tools with prior runs but none in 14 days). Visible to all roles read-only (transparency is a feature); admin controls hidden for builders.

**Tool detail** (`/w/[slug]/tools/[id]`): tabs — Overview (Receipt, per-source run counts so a silently failing hook is visible: "0 via hook, 12 via mcp"), Runs (paginated table, test runs labeled, manual runs attributed "added by X", baseline-change markers), Setup (the Connect snippets), Settings (baseline edit — lead/admin only, re-runs the Receipt, writes `baseline_history`; credit edit — owner or lead/admin, sets `minutes_saved_override` within (0, 480], writes `credit_history`, labeled builder-set on every receipt; archive).

**Settings**: general (name, rate, currency, timezone, plan section: "Free while in beta — contact to upgrade"), members (list + link-invite create/revoke with use counts), keys (user-level: every member creates/revokes their own ingest keys; admins see everyone's grouped by owner, revoke any, and are the only role that can create read keys; scope, prefix, `last_used_at` — "never used" is the #1 onboarding debug signal), public (live preview of the real page behind a "not published" scrim, enable toggle, slug, show_tools/show_builders/show_money toggles, badge embed code).

**Public page** (`/p/[slug]`, ISR 300s): headline "Acme's builders saved 340 hours in the last 90 days" + `undercounted` tag → inline Undercount explainer; trend sparkline; runs measured / builders active / Multipliers earned (config-gated); optional top-tools (names + hours only). Footer "Counted with PositiveROI — the Undercount methodology" → landing; **not removable on hosted free tier**. Disabled/unknown slug → plain 404.

**Badge** (`/badge/[slug]` with optional `.svg` suffix stripped, `?theme=light|dark`): flat server-templated SVG ~240×54, drawn lightning mark (no emoji), "340 hrs saved · last 90 days · PositiveROI", links to `/p/[slug]`, `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

**Landing** (`/`): hero "Your team is building AI tools. Prove what they're worth." with a **static screenshot** of the real dashboard (no live ticking); scroll-replayed Receipt animation (45 → 27 → 13.5); four capture types converging on one endpoint (curl + plugin install side by side); Multiplier ring block; public page/badge proof block; open-source MIT block (no live stars widget); CTA. Self-hosted deployments swap the CTA via `flags.ts`.

**Pricing** (`/pricing`, hosted only): Free (up to 5 builders — copy only, not enforced, "free while in beta"), Team $29/mo flat (unlimited + API, "Contact to upgrade" mailto), Self-hosted (free forever, MIT → docs). FAQ: data ownership, after-beta, what counts as a builder.

**Empty states**: every view ships its future-self skeleton per Design 1's table (ghosted sample-watermarked tiles on company dashboard; ring at zero with "your multiplier starts at run one"; tool detail shows the live listener until run #1; "no runs in this period — 214 all-time" with period widen; metrics seeded at zero with a how-to link; API keys explainer).

`/admin` (hosted, `HOSTED_ADMIN_EMAILS` only, 404s self-hosted): bare table — workspace, builders, events, created_at. Lead-gen sensor stub.

---

## 8. Custom metrics model

`metric_definitions` per workspace (key, name, unit: currency/count/duration), seeded at creation with `revenue_influenced` (currency), `leads_generated` (count), `client_touchpoints` (count). Values are event-attached rows in `metric_values` (`occurred_at` denormalized for direct timeseries; workspace-consistency trigger). The **only** write path is the ingest `metrics: {key: value}` map — including the dashboard's manual-log form, which passes through the same internal ingest function. Unknown keys never fail the event: it's `accepted` with `warnings: ["unknown_metric:foo"]`. Unit governs formatting only; all values `numeric(14,2)`. Definitions CRUD by lead/admin via server actions; deleting a definition cascades values behind a confirm dialog showing the count. Rollups: `sum(value)` per definition per period, filtered through non-test events; tiles on the company dashboard drill to contributing events.

---

## 9. Multiplier/badge mechanics

- **The rule:** 180 credited hours in the **trailing 30 days** = one full-time job (42h/week) = **Multiplier**. One SQL sum over `(workspace_id, owner's tools, occurred_at >= now() - 30 days, is_test = false)`; timezone-independent by construction.
- **Ring:** always shows current trailing-30d progress; it decays honestly and never resets on a calendar boundary.
- **Tiers are display-only labels** computed from the same number: First Run (≥1 run), Saver (9h), Operator (45h), Heavy Lifter (90h), Multiplier (180h), ×2/×3 (360h, 540h — label only). Nothing but `multiplier` is ever stored.
- **Award:** lazy, no cron — whenever builder progress is computed (builder dashboard, company dashboard, ingest `tool_totals`) and hours ≥ 180, the service-role path runs `insert into builder_badges ... on conflict do nothing`. Earned Multiplier is **permanent** ("Multiplier — first earned March 2026") even if the trailing rate later drops; the ring shows the current truth alongside the laurel.
- **Celebration:** a toast + company-dashboard mention ("Dana became a Multiplier"). Full-screen animation, feed announcements, and history strips are deferred.
- Every badge and tier click opens the same drillable receipt for the qualifying 30 days — badges are computed from the identical rows as the dashboards.
- Attribution = tool owner. FTE on company views normalizes to the period: `hours / (180 × period_days / 30.44)`.

---

## 10. Security decisions

1. **Two auth planes, never mixed.** Humans: Supabase Auth JWT; RLS grants SELECT to workspace members only; anon role has zero policies. Machines: `Authorization: Bearer <key>` → sha256 → indexed `key_hash` lookup (`revoked_at is null`) in route handlers on the service-role client, every query scoped by the key's `workspace_id`. SHA-256 is correct for 238-bit random keys (bcrypt is for low-entropy passwords).
2. **Single write path.** No RLS insert/update/delete policies exist. All mutations (including manual run logging and test runs) go through server actions/route handlers behind `requireMember(workspaceId, minRole)` — one place for clamps, caps, audits, and attribution. This closes C1-M1/M2 structurally, and removes SECURITY DEFINER RPCs entirely (the two remaining definer helpers and triggers pin `search_path = public, pg_temp`).
3. **Key scopes are (almost) disjoint.** `ingest` = `POST /api/ingest`, `POST /api/v1/tools` (capped), slim `GET /api/v1/tools`, `GET /api/v1/summary`. `read` = full read API. A leaked ingest key can never see money, per-builder breakdowns, timeseries, or metadata. Rotation: create → switch → revoke; revoked keys 401 immediately; rows retained for event attribution; `last_used_at` write-throttled to once/minute.
4. **The estimate is bounded and audited (the credibility core).** Schema cap 480 min; API-created tools capped at 120 raw min and stamped `origin='api'`; every baseline set/change writes `baseline_history` (who/when/old/new); baseline edits are lead/admin only; overrides clamp to `[0, raw_estimate]` — a caller can only *lower* credit; admin dashboard lists API-registered tools and outlier baselines (>120) for review. Forgery by a valid key-holder is not preventable — the model is attribution (`api_key_id`, `created_by` on every event), bounded self-report, and drill-down.
5. **Test data never touches headline numbers.** `is_test` is excluded from every aggregate, the public page, the badge, and badge awards; test runs are labeled in drilldowns and one-click purgeable.
6. **Invites:** link-only, multi-use with `max_uses`/`use_count`, revocable, 14-day expiry, token stored hashed; acceptance derives workspace and role strictly from the `token_hash` row; invite page loads no third-party resources.
7. **What the hook may send (contract, enforced by test fixtures):** tool slug, timestamp, `source: hook`, `idempotency_key` = `hook:{session_id}:{sha256(prompt)[:16]}`, `metadata: {surface}`. **Never:** prompt text or substrings, skill arguments, file paths, cwd, env values, or anything prompt-derived. The hook never writes to stdout (prompt-injection surface) and never exits non-zero. The disk queue is safe *because* of this rule.
8. **Public path:** exactly one anon→service-role gate, `getPublicWorkspace(slug)` (checks `public_enabled and public_slug = $1`), 404 otherwise with no enumeration signal, covered by an explicit test. Exposed data strictly per `public_config`; never emails, metadata, metric values, or raw estimates.
9. **Abuse:** 120 req/min/key fixed-window upsert limiter, probabilistic cleanup; body ≤ 256 KB, batch ≤ 100, metadata ≤ 8 KB; `occurred_at` bounds app-side; `SUPABASE_SERVICE_ROLE_KEY` guarded by a `server-only` import in `admin.ts`.
10. **Accepted residual risks (documented):** builder-visible company transparency (deliberate product choice — flag to buyers); workspace-creation spam (per-user cap deferred); idempotency griefing (requires the workspace's own key); capped tool creation via ingest keys (see decision log).

---

## 11. Ordered build plan

Sizes: S ≈ one agent, short; M ≈ one agent, one focused stretch; L ≈ one agent, long stretch (split-able). Nothing in Phase 2 starts until Phase 1 is frozen **in order**.

**Phase 0 — pre-session checklist (Stav + one setup agent)**
- 0.1 **Decision Zero: resolved — the name is PositiveROI.** npm scope `@positiveroi`, key prefixes `roi_ingest_`/`roi_read_`, config dir `~/.positiveroi/`, plugin name `positiveroi`, domain positiveroi.dev (later).
- 0.2 Google Cloud OAuth client + consent screen; Supabase Auth redirect URLs (incl. the vercel.app domain); Vercel project + env vars; confirm Supabase project reachable. (S)

**Phase 1 — freeze, single-threaded**
1. `packages/core`: constants (0.6, 0.5, 180, caps, key prefixes), `computeMinutesSavedPerRun`, zod schemas (ingest event/batch incl. `source`/`is_test`, tool-create, all responses), `makeIdempotencyKey`, snippet templates; unit tests. (S)
2. Supabase migrations 0001–0007 exactly as §3; apply to local `supabase start`; integration test harness; methodology round-trip test (TS function vs generated column). (M) — depends on 1
3. `lib/ingest-core.ts` as a pure function (key/member context → results): key verify, rate limit, validation, tool resolution, clamps, bounds, multi-row idempotent insert, metric values + warnings, `tool_totals`, lazy badge hook; unit + integration tests. **Ingest and read contracts (§4) frozen here.** (M) — depends on 2
4. Freeze route map (§7) and commit this document as `docs/architecture.md`. (S)

**Phase 2 — four parallel tracks**

*Track A — web app (the long pole; serial spine A1→A4, then A5–A10 parallelize)*
- A1 Auth (login, `/auth/callback`, middleware) + onboarding + workspace-creation server action (workspace, admin member, seeded metrics, **default ingest key**, silent timezone) + invite accept flow (token → cookie → callback → join). (M)
- A2 App shell: `/w/[slug]` layout, sidebar, workspace switcher, period selector, dark/light theming, `guards.ts`, `flags.ts`. (M)
- A3 API routes wrapping ingest-core: `/api/ingest` (+CORS/OPTIONS), `/api/v1/*` incl. scope-shaped `/tools` and `/summary`; key management server actions. (M) — depends on A1
- A4 Tools: directory, **4-step wizard with the Receipt animation**, tool detail tabs, baseline edit (lead/admin + audit), test-run + manual-log server actions, live first-run listener (3s poll). (L) — depends on A2, A3
- A5 Builder dashboard: hero stats, Multiplier Ring, tool cards, recent-runs strip, drilldowns. (M) — depends on A4
- A6 Company dashboard: 4 headline stats, trend chart, metric tiles, two leaderboards (left join), Gone Quiet, role-aware controls; lazy badge award on load. (M) — depends on A4
- A7 Settings: general, members + link invites, keys UI (plaintext-once, last_used), public-page config with live preview. (M) — depends on A2
- A8 Public page + badge SVG through `public-gate.ts`, ISR/cache headers, gate test. (S) — depends on A6 (shares rollup code)
- A9 Landing, pricing (hosted flag), `/methodology`. (M) — depends on A2 only; do late; Decision Zero resolved (PositiveROI)
- A10 `/admin` stub. (S)

*Track B — packages (starts after Phase 1 step 3)*
- B1 `mcp-server`: config reader, 4 tools, stdio; esbuild single-file bundle script; tests against a mock ingest server. (M)
- B2 `sdk`: ~40-line client — `logRun()` posts one event with auto idempotency key, one retry, silent fail; tests. (S)

*Track C — plugin (starts after B1 dist exists)*
- C1 Scaffold, `hooks.json`, `capture.mjs` + ndjson queue; **verify `${CLAUDE_PLUGIN_ROOT}` expansion in the first hour**; node test piping fixture stdin (asserts: silent when unconfigured, exit 0 on network failure, queue drain, payload contains no prompt content); idempotency fixture shared with core. (M)
- C2 `impact-setup` + `register-tool` skills (incl. `hookCaptured` list write), vendored `mcp/server.mjs`, `marketplace.json`, plugin README. (M)

*Track D — docs / CI / scripts (starts after Phase 1)*
- D1 `ci.yml`: turbo lint/typecheck/test/build + `supabase start` DB job (migrations from zero, **RLS isolation tests, idempotency tests, key-hash tests — the project's only security review**) + plugin fixture test. (M)
- D2 Docs set: README, methodology (for a skeptical CFO), 4 quickstarts (each ends "refresh your dashboard; the run is there", snippets from `core/snippets.ts`), ingestion + read API reference, mcp-server, sdk, self-hosting (incl. SMTP note, Supabase free-tier pausing warning, OAuth setup), architecture. (M)
- D3 `scripts/setup.mjs` (env prompts, `supabase db push`, seed) + `.env.example` + Vercel deploy button; `seed-demo.mjs` with now-relative dates (run post-launch). (M)
- D4 LICENSE, CONTRIBUTING ("PRs changing methodology constants will be declined — open an issue"), CODE_OF_CONDUCT, SECURITY, issue templates, Changesets config (publish deferred). (S)

**Phase 3 — integration gate (single-threaded, all tracks merged)**
- G1 REST path: signup → onboarding → wizard → curl with real key → run on builder + company dashboards → public page + badge render the same number.
- G2 Plugin path: real Claude Code session → `/plugin marketplace add` from the repo → `impact-setup` → `register-tool` → invoke the skill → hook event lands → dashboard shows it (`via hook`).
- G3 MCP path: `log_run` from a session without the hook mapping → event lands (`via mcp`); `log_run` on a hook-captured tool refuses.
- G4 SDK path: scratch page calls `logRun()` from a browser origin (proves CORS) → event lands (`via sdk`).
- G5 Read API: read key pulls `/api/v1/stats`; ingest key gets 403 on `/api/v1/stats` and 200 on `/api/v1/summary`.
- G6 Full CI green including RLS isolation suite; checkpoint commit + Vercel production deploy.

---

## 12. Verification checklist (proof per V1 item)

| V1 item | Proof |
|---|---|
| Workspaces + roles + invites | Two-browser test: admin creates workspace, copies invite link, second user joins as builder; builder sees only their own API keys in Settings and cannot reach General/Members/Public; RLS CI test shows zero cross-workspace rows |
| Guided registration + methodology | Register at 45 min + high judgment → tool stores 13.5; DB generated column equals `core` function in round-trip test; Receipt shows both cuts on screen |
| REST ingestion + idempotency | Same batch POSTed twice → second response all `duplicate`, run count unchanged; override 999999 → clamped to raw estimate; `occurred_at` next year → 422 |
| Rate limit / abuse | 121st request in a minute → 429 with `Retry-After`; 8KB+ metadata → 422 |
| MCP server | G3 transcript: `register_tool` returns methodology string; `log_run` returns multiplier progress; refusal on hook-captured tool |
| Claude Code plugin + hook | G2 transcript + event row with `source='hook'`; fixture test proves payload contains no prompt content; kill network → event in queue.ndjson → next invocation drains it |
| Builder dashboard | After G1–G3: hours, ring %, per-source counts match a hand-computed `sum(minutes_saved)/60` from the runs table |
| Company dashboard | Two builders' events → leaderboards rank correctly; FTE = hours/180 pro-rated; rate change updates money; tool silent 14+ days (seeded) appears in Gone Quiet |
| Test runs excluded | "Send a test run" → run visible with test chip, headline totals and public page unchanged |
| Custom metrics | Ingest with `metrics` map → tile total updates; unknown key → accepted + warning; drilldown lists contributing events |
| Multiplier badge | Seed a builder past 180h trailing-30d → badge row appears on next dashboard load, exactly once (rerun idempotent); laurel persists after events age out |
| Public page + badge | Enabled → `/p/slug` and badge SVG render matching numbers; disabled → both 404; `show_money=false` hides money; footer link present |
| Read API | BI-style curl with read key returns stats/timeseries; revoked key → 401 within one request |
| Baseline audit | Lead edits baseline → `baseline_history` row + drilldown marker; builder attempt → 403 |
| Docs + self-hosting | Fresh machine (or clean container): follow self-hosting doc verbatim → local app serves G1 end-to-end; every quickstart executed literally once |
| Landing + pricing | Deployed at production URL; hosted shows pricing; `NEXT_PUBLIC_DEPLOYMENT=self-hosted` hides pricing and `/admin` 404s |

---

## 13. Deferred to v1.1

- Email invites + transactional email provider (SMTP/Resend); custom SMTP for production magic links (Google OAuth primary until then)
- npm publishing of core/sdk/mcp-server via the already-configured Changesets flow; `npx` install path in docs switches from vendored file after publish
- Demo workspace population (`seed-demo.mjs` exists; run + link from README post-launch)
- Stripe/billing and free-tier enforcement (pricing is copy-only in v1)
- Stored tier ladder, ×2/×3 badges, full-screen celebration, feed announcements, multiplier history strips, builder profile pages
- Public `GET /api/v1/tools/{id}/runs` endpoint (drilldown is dashboard-internal in v1)
- Anomaly flags ("412 runs in one hour — review?") and cross-source possible-duplicate surfacing
- Gone Quiet nudge actions (email/in-app); panel is display-only in v1
- SDK batching/queue with backoff; Supabase Realtime for live listeners (3s polling in v1)
- `pg_cron` daily rollups / materialized aggregates (documented upgrade path; not needed below ~1M events/year)
- Per-user workspace-creation caps; org-level SSO; baseline approval workflow above thresholds
- `/admin` lead-gen view beyond the bare table (filters, trends, export)
- Self-hosted telemetry (explicitly none in v1 — stated in README as a trust signal)