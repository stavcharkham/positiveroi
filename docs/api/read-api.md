# Read API

Pull your workspace numbers into BI tools, spreadsheets, or scripts. All endpoints live under `/api/v1/` and authenticate with:

```
Authorization: Bearer roi_read_...
```

Read-scoped keys expose company-wide numbers, so only workspace admins can create them (Settings → API Keys). Every aggregate excludes test runs. Responses are cached briefly (`Cache-Control: private, max-age=60`).

## Key scopes

Ingest keys are for machines that log runs; read keys are for tools that consume numbers. A leaked ingest key can never see money, per-builder breakdowns, or timeseries.

| Endpoint | `ingest` key | `read` key |
|---|---|---|
| `POST /api/ingest` | yes | no |
| `POST /api/v1/tools` (register, capped) | yes | no |
| `GET /api/v1/tools` | slim shape | full shape |
| `GET /api/v1/summary` | yes | yes |
| `GET /api/v1/stats` | no | yes |
| `GET /api/v1/timeseries` | no | yes |
| `GET /api/v1/metrics` | no | yes |
| `GET /api/v1/metric-definitions` | yes | yes |

Calling an endpoint outside your key's scope returns `403 forbidden_scope`. The error envelope and codes are shared with the [ingestion API](ingestion.md#error-envelope).

## GET /api/v1/stats

Headline numbers for a period.

| Param | Values | Notes |
|---|---|---|
| `period` | `week` \| `month` \| `quarter` | Trailing 7 / 30 / 90 days |
| `from`, `to` | `YYYY-MM-DD` | Explicit range, workspace timezone. Omit everything for all-time |

```bash
curl -H "Authorization: Bearer roi_read_YOUR_KEY" \
  "https://positiveroi.vercel.app/api/v1/stats?period=month"
```

```json
{
  "range": { "from": "2026-06-08", "to": "2026-07-08" },
  "runs": 1843,
  "minutes_saved": 24762,
  "hours_saved": 412.7,
  "fte_equivalent": 2.33,
  "money_value": { "amount": 24762, "currency": "USD", "hourly_rate": 60 },
  "active_tools": 14,
  "builders": 6,
  "methodology": "measured runs x conservative estimated minutes per run"
}
```

`fte_equivalent` is pro-rated: `hours / (180 × period_days / 30.44)`. See [the methodology](../methodology.md#the-fte-math).

## GET /api/v1/timeseries

Bucketed series for charts.

| Param | Values | Notes |
|---|---|---|
| `bucket` | `day` \| `week` \| `month` | Bucketed in the workspace timezone |
| `from`, `to` | `YYYY-MM-DD` | Range |
| `tool` | slug | Optional: restrict to one tool |

```json
{
  "buckets": [
    { "start": "2026-07-01", "runs": 61, "minutes_saved": 823.5 },
    { "start": "2026-07-02", "runs": 58, "minutes_saved": 783 }
  ]
}
```

## GET /api/v1/metrics

Totals per custom metric definition over a range.

| Param | Values |
|---|---|
| `from`, `to` | `YYYY-MM-DD` |

```json
{
  "metrics": [
    { "key": "revenue_influenced", "name": "Revenue influenced", "unit": "currency", "total": 48200 },
    { "key": "leads_generated", "name": "Leads generated", "unit": "count", "total": 131 }
  ]
}
```

## GET /api/v1/metric-definitions

The workspace's metric definitions — key, name, unit — ordered by creation. Definitions only: no values, no totals. Accepts **both** scopes (like `/summary`), so ingest-keyed agents can discover which keys to attach as `metrics` when logging runs; the MCP `list_metrics` tool uses it.

```json
{
  "metrics": [
    { "key": "revenue_influenced", "name": "Revenue influenced", "unit": "currency" },
    { "key": "leads_generated", "name": "Leads generated", "unit": "count" }
  ]
}
```

`unit` is one of `currency`, `count`, `duration`.

## GET /api/v1/summary

The one aggregate ingest keys may also read (it powers setup verification and progress narration). Deliberately narrow: no money, no per-builder breakdown, no timeseries.

```json
{ "workspace": "acme", "runs_30d": 1843, "hours_30d": 412.7, "active_tools": 14, "builders": 6 }
```

## GET /api/v1/tools

List tools. The shape depends on the key's scope:

- **ingest** (slim): `id`, `slug`, `name`, `type`, `status`, `minutes_saved_per_run`
- **read** (full): slim fields plus `owner_display_name`, `runs_30d`, `hours_all_time`, `last_run_at`

`minutes_saved_per_run` is the credit new runs snapshot: the builder-set number when the tool's owner set one in the dashboard, otherwise the suggested Undercount.

## POST /api/v1/tools

Register a tool programmatically (ingest scope; used by the MCP `register_tool` tool).

```json
{
  "name": "Weekly pipeline digest",
  "type": "automation",
  "description": "Compiles the pipeline report each Monday",
  "raw_estimate_minutes": 45,
  "high_judgment": false
}
```

Rules on this path: `raw_estimate_minutes` is hard-capped at **120** (`422` above it; bigger baselines must be set in the dashboard), the tool is owned by the key's creator, stamped `origin: api`, and the creation is written to the baseline audit trail.

`201`:

```json
{
  "tool": {
    "id": "9d1e...",
    "slug": "weekly-pipeline-digest",
    "minutes_saved_per_run": 27,
    "methodology": "45 min baseline − 40% confidence cut = 27 credited min/run"
  }
}
```

If the slug already exists, `409 slug_taken` returns the existing tool's `id` and `slug`, so clients can log runs against it instead of creating a duplicate.

## What is not public API

The per-run drill-down (the Receipt) is dashboard-internal in v1; there is no `runs` list endpoint. If you need raw events in your warehouse, self-host and read your own Postgres.
