# Ingestion API

One endpoint. Every capture path (REST, SDK, MCP, Claude Code hook) converges on it.

```
POST /api/ingest
```

## Authentication

```
Authorization: Bearer roi_ingest_...
```

Requires an API key with **ingest** scope. Every member creates their own in Settings → API Keys. Keys belong to the person who made them, so revoking one never breaks anyone else's tools. Revoked keys get `401` on the next request. What an ingest key can and cannot see is listed in the [scopes table](read-api.md#key-scopes).

## Request body

Send one bare event object, or a batch:

```json
{
  "events": [
    {
      "tool": "weekly-pipeline-digest",
      "occurred_at": "2026-07-07T09:15:00Z",
      "source": "rest",
      "idempotency_key": "trg:run_8f2k1",
      "minutes_saved": 12,
      "is_test": false,
      "metadata": { "records": 42 },
      "metrics": { "leads_generated": 3 }
    }
  ]
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `tool` | string | yes | Tool slug or UUID, 1–100 chars |
| `occurred_at` | string | no | ISO 8601 datetime with offset. Default: now. Rejected if more than 5 minutes in the future or more than 90 days in the past |
| `source` | string | no | One of `rest`, `mcp`, `hook`, `sdk`. Default `rest`. `manual` is rejected on this path (dashboard-internal only) |
| `idempotency_key` | string | no | 1–128 chars, scoped per tool. Reuse the same value on retry |
| `minutes_saved` | number | no | Override, 0–480. Clamped server-side to `[0, tool baseline]`; can only lower credit |
| `is_test` | boolean | no | Default `false`. Test runs never count in any aggregate |
| `metadata` | object | no | Max 8 KB. Stored with the run, visible in drill-downs |
| `metrics` | object | no | Map of metric key to number. Keys match `^[a-z0-9_]{2,40}$`, max 20 per event |

Limits: 1–100 events per batch, request body max 256 KB.

## Response

`200` even when individual events fail; each event gets its own status, in request order:

```json
{
  "results": [
    {
      "status": "accepted",
      "event_id": "6a7c9f2e-1b0d-4e5a-9c3f-2d8b7a6e5f40",
      "warnings": ["unknown_metric:foo"],
      "tool_totals": {
        "tool": "weekly-pipeline-digest",
        "owner_hours_30d": 112.5,
        "multiplier_progress": 0.62
      }
    },
    { "status": "duplicate", "event_id": "6a7c9f2e-1b0d-4e5a-9c3f-2d8b7a6e5f40" },
    {
      "status": "rejected",
      "error": { "code": "unknown_tool", "message": "no tool with slug 'typo-digest' in this workspace" }
    }
  ],
  "accepted": 1,
  "duplicates": 1,
  "rejected": 1
}
```

- **`accepted`**: the run is counted. `tool_totals` reports the tool owner's trailing-30-day credited hours and Multiplier progress, so callers can narrate progress without read access.
- **`duplicate`**: an event with this `idempotency_key` already exists for this tool. Silent no-op; retrying a whole batch is always safe.
- **`rejected`**: this event was not stored; `error.code` says why (for example `unknown_tool`). Other events in the batch are unaffected.

Unknown metric keys do **not** reject an event. The event is accepted and the response carries `warnings: ["unknown_metric:<key>"]`.

## Idempotency

The uniqueness constraint is `(tool, idempotency_key)`. Omit the key and every request creates a new event; pass one and replays are free. Recommended formats:

- Automations: your platform's run ID, e.g. `trg:run_8f2k1`
- SDK: generated automatically (`sdk:<uuid>` per call)
- Hook: generated automatically (`hook:<session>:<prompt-hash>`)

## Rate limits and bounds

- **120 requests per minute per key.** Over the limit: `429` with a `Retry-After` header. Batch instead of hammering: 100 events in one request is one request.
- Body over 256 KB: `413`.
- Malformed fields (bad datetime string, unknown source), batch over 100: `422` with `error.details[]` listing each violation.
- An `occurred_at` that parses but falls outside the allowed window is a **per-event** `rejected` result with code `occurred_at_out_of_range` inside a `200` (the rest of the batch still lands) — not a `422`.

## Error envelope

All non-`200` responses share one shape:

```json
{ "error": { "code": "validation_failed", "message": "...", "details": [] } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing, unknown, or revoked key |
| 403 | `forbidden_scope` | Key scope does not allow this endpoint |
| 404 | `not_found` | No such route |
| 413 | `payload_too_large` | Body over 256 KB |
| 422 | `validation_failed` | Schema violation; `details[]` lists each problem |
| 429 | `rate_limited` | Over 120 req/min; retry after `Retry-After` seconds |
| 500 | `internal` | Our fault; safe to retry with the same idempotency keys |

## CORS

`/api/ingest` (and `/api/v1/*`) answer `OPTIONS` preflight with `Access-Control-Allow-Origin: *` and allow the `Authorization` and `Content-Type` headers, so browser apps can log runs directly.

## Registering tools via API

`POST /api/v1/tools` (ingest scope) registers a tool programmatically, with a hard 120-raw-minute cap. Documented in [read-api.md](read-api.md#post-apiv1tools).
