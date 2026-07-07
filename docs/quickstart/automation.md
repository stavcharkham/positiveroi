# Quickstart: automations

For anything that runs on a schedule or a trigger: Zapier, Trigger.dev, n8n, Make, GitHub Actions, cron scripts. One HTTP POST per run.

## What you need

- Your tool's **slug** (shown on the tool's Setup tab after you register it in the dashboard).
- An **ingest API key** (`roi_ingest_...`), from Settings → API Keys. Onboarding created one for you.
- Your endpoint URL. Hosted: `https://positiveroi.vercel.app`. Self-hosted: your deployment URL.

## curl

```bash
curl -X POST https://positiveroi.vercel.app/api/ingest \
  -H "Authorization: Bearer roi_ingest_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "weekly-pipeline-digest", "idempotency_key": "run-'"$(date +%s)"'"}'
```

A `200` with `"status": "accepted"` means the run is counted. Add this as the last step of your automation so it only fires on successful runs.

## Idempotency (make retries safe)

If your platform retries failed steps, pass an `idempotency_key` that is stable for that run, for example the platform's own run ID:

```json
{ "tool": "weekly-pipeline-digest", "idempotency_key": "trg:run_8f2k1" }
```

Replays with the same key are silent no-ops (`"status": "duplicate"`); the run is never counted twice. Keys are scoped per tool, max 128 characters.

## Zapier

Add a **Webhooks by Zapier** step at the end of your Zap:

- Action: `POST`
- URL: `https://positiveroi.vercel.app/api/ingest`
- Payload type: `json`
- Data: `tool` = your tool slug, `idempotency_key` = the Zap's run ID (use `{{zap_meta_id}}`)
- Headers: `Authorization` = `Bearer roi_ingest_YOUR_KEY`

## Trigger.dev

Call the endpoint at the end of your task with the run ID as the idempotency key:

```ts
await fetch("https://positiveroi.vercel.app/api/ingest", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.POSITIVEROI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    tool: "weekly-pipeline-digest",
    idempotency_key: `trg:${ctx.run.id}`,
  }),
});
```

## Optional fields

Attach business metrics or metadata to any run:

```json
{
  "tool": "weekly-pipeline-digest",
  "idempotency_key": "trg:run_8f2k1",
  "metrics": { "leads_generated": 3 },
  "metadata": { "records": 42 }
}
```

Metric keys must exist in your workspace (Settings → Metrics); unknown keys don't fail the run, they come back as warnings. Full contract, including batching up to 100 events per request: [docs/api/ingestion.md](../api/ingestion.md).

Refresh your dashboard. The run is there.
