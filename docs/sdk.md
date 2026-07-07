# SDK

`@positiveroi/sdk` is a deliberately tiny client (about 40 lines) for logging runs from apps: internal tools, scripts, dashboards, browser code. If you'd rather not add a dependency, a plain `fetch` to [`/api/ingest`](api/ingestion.md) does the same thing.

## Install

```bash
pnpm add @positiveroi/sdk
```

Until the package is published to npm, consume it from this repo: add the monorepo as a workspace or copy `packages/sdk/src` (it has no runtime dependencies). The `npx`/npm path activates once the org exists.

## Usage

```ts
import { PositiveROI } from "@positiveroi/sdk";

const roi = new PositiveROI({
  apiKey: "roi_ingest_YOUR_KEY",
  endpoint: "https://positiveroi.vercel.app",
});

await roi.logRun({ tool: "quote-generator" });
```

`logRun` accepts the same optional fields as the ingest API: `minutes_saved` (only lowers credit), `metrics`, `metadata`, `is_test`, `occurred_at`, and an explicit `idempotency_key` if you want to control dedup yourself.

## Configuration resolution

Explicit constructor options win. Where they're omitted, the SDK resolves in this order:

1. Environment variables: `POSITIVEROI_API_KEY`, `POSITIVEROI_ENDPOINT`
2. `~/.positiveroi/config.json` (`apiKey`, `endpoint`); Node only, browsers must pass options explicitly

## Design choices

- **Auto idempotency.** Every `logRun` call generates a unique key (`sdk:<uuid>`), stable across that call's retry. A flaky network cannot double-count a run.
- **One retry, then silent failure.** Impact logging must never break the tool it measures. The SDK retries once and then drops the event without throwing. If you need delivery guarantees, log from a server-side job with your own retry and a stable `idempotency_key`.
- **No queue, no batching.** One call, one event. Batching and offline queues are on the v1.1 list; the API already accepts 100-event batches if you build your own.

## Keys in the browser

Ingest keys are safe-ish to expose the way analytics write keys are: the holder can log runs to your workspace and read a slim summary, but can never read money, per-builder data, or timeseries (see [key scopes](api/read-api.md#key-scopes)). If abuse worries you, proxy `logRun` through your own backend.
