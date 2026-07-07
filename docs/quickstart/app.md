# Quickstart: apps

For internal tools, scripts, and dashboards with their own code: use the SDK. It is a tiny fetch wrapper, one call per run.

## Install

```bash
pnpm add @positiveroi/sdk
```

Until the package is on npm, install from the repo (see [docs/sdk.md](../sdk.md)).

## Log a run

```ts
import { PositiveROI } from "@positiveroi/sdk";

const roi = new PositiveROI({
  apiKey: "roi_ingest_YOUR_KEY",
  endpoint: "https://positiveroi.vercel.app",
});

// Call this from the key action your tool performs:
await roi.logRun({ tool: "quote-generator" });
```

Put the `logRun` call at the moment your tool completes its unit of work: the report is generated, the quote is sent, the record is synced. One completed unit of work = one run.

## Behavior you get for free

- **Auto idempotency.** Each `logRun` call generates its own idempotency key, stable across that call's internal retry. Network blips never double-count a run.
- **One retry, then silent.** The SDK retries once on failure and then gives up quietly. It will never crash your app or block your user because impact logging was down.
- **Browser-safe.** The ingest endpoint answers CORS preflight, so `logRun` works from frontend code too. Treat the ingest key like any client-exposed token: it can log runs and read a slim summary, nothing more.

## Optional fields

```ts
await roi.logRun({
  tool: "quote-generator",
  metrics: { revenue_influenced: 1200 },
  metadata: { customer: "acme" },
  minutes_saved: 5, // override: only ever lowers credit for a partial run
});
```

Keep secrets and personal data out of `metadata`; it is stored with the run and visible in the drill-down.

No SDK? A plain `fetch` works just as well; the shape is one JSON object (see [docs/api/ingestion.md](../api/ingestion.md)).

Refresh your dashboard. The run is there.
