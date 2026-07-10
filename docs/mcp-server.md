# MCP server

`@positiveroi/mcp-server` lets any MCP client (Claude Code, other agent runtimes) register tools and log runs. It talks stdio and needs only an ingest-scoped API key.

## Running it

Inside Claude Code, you don't run it yourself: the PositiveROI plugin ships a vendored single-file build and wires it up automatically ([quickstart](quickstart/skill-plugin.md)).

For other MCP clients, build and point at the bundle from this repo:

```bash
pnpm install
pnpm --filter @positiveroi/mcp-server build
```

Then register it in your client's MCP config as a stdio server running `node` with the built entry (`packages/mcp-server/dist/cli.js`). Once the package is published to npm, this becomes `npx -y @positiveroi/mcp-server`.

## Configuration

Two sources, in order:

1. **Environment variables** (win over the file):
   - `POSITIVEROI_API_KEY`: an ingest-scoped key (`roi_ingest_...`)
   - `POSITIVEROI_ENDPOINT`: your deployment URL
2. **`~/.positiveroi/config.json`**:

```json
{
  "endpoint": "https://positiveroi.vercel.app",
  "apiKey": "roi_ingest_...",
  "tools": { "weekly report": "weekly-pipeline-digest" },
  "hookCaptured": ["weekly-pipeline-digest"]
}
```

- `tools` maps trigger phrases to tool slugs (used by the Claude Code plugin's capture hook).
- `hookCaptured` lists tools whose runs the hook logs automatically; `log_run` refuses these to prevent double-counting.

## Tools

### `register_tool`

Register a new tool so its runs count toward impact, using the conservative time-saved methodology.

| Param | Required | Notes |
|---|---|---|
| `name` | yes | |
| `type` | yes | `automation` \| `skill` \| `agent` \| `app` |
| `description` | no | |
| `raw_estimate_minutes` | yes | The most conservative estimate of manual minutes one run replaces. Max 120 via this path |
| `high_judgment` | yes | Does a human still make a meaningful decision in this task? |

Calls `POST /api/v1/tools` and returns the credited minutes with the methodology string, e.g. `45 min baseline − 40% confidence cut = 27 credited min/run`, so the agent shows the builder exactly how the number was derived. On a slug conflict it returns the existing tool and suggests `log_run`.

### `log_run`

Log one run of a registered tool after its work completes.

| Param | Required | Notes |
|---|---|---|
| `tool` | yes | Slug or name; exact slug wins |
| `minutes_saved` | no | Only to lower credit for a partial run |
| `metrics` | no | Map of metric key to number |
| `metadata` | no | |
| `idempotency_key` | no | Reuse the same value on retry |
| `force` | no | Override the hook-captured refusal |

If the tool is in the config's `hookCaptured` list, `log_run` refuses ("this tool's runs are logged automatically by the hook") unless `force: true`. On success it returns the status plus `owner_hours_30d` and `multiplier_progress` from the ingest response, so the agent can narrate: "logged — you're at 62% of your Multiplier badge."

### `list_tools`

Lists the workspace's tools (slim shape: id, slug, name, type, status, credited minutes per run). Used to resolve slugs.

### `list_metrics`

Lists the workspace's business metric definitions (key, name, unit) via `GET /api/v1/metric-definitions`. No input. Use it to discover which keys the workspace tracks (e.g. `revenue_influenced`), then attach them as `metrics: {key: value}` when calling `log_run`.

### `get_summary`

Workspace totals: runs and hours over the trailing 30 days, active tools, builder count. This is the full extent of what an ingest key can read; money, per-builder stats, and timeseries need a read-scoped key via the [Read API](api/read-api.md).

## Validation

All inputs validate against the shared schemas in `@positiveroi/core`, the same ones the server enforces. What the MCP server accepts is exactly what the API accepts.
