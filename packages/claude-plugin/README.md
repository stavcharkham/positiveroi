# PositiveROI Claude Code Plugin

Measure the time your AI tools actually save. Runs of your registered tools are logged automatically to your PositiveROI workspace — no manual bookkeeping.

## Install

In Claude Code:

```
/plugin marketplace add stavcharkham/positiveroi
/plugin install positiveroi@positiveroi
```

Then connect it to your workspace:

```
/positiveroi:impact-setup
```

You'll need your workspace **ingest key** (dashboard → Settings → API Keys, starts with `roi_ingest_`) and your server's endpoint URL.

## What's inside

| Piece | What it does |
|---|---|
| `impact-setup` skill | Stores the ingest key in `~/.positiveroi/config.json` and verifies the connection with a live `get_summary` call |
| `register-tool` skill | Guided, conservative interview that registers a tool and wires up automatic capture |
| MCP server (`mcp/server.mjs`, bundled) | Four tools: `register_tool`, `log_run`, `list_tools`, `get_summary` |
| Capture hook (`hooks/capture.mjs`) | Logs a run automatically when a prompt starts with a registered tool's slash command |

## What the hook sends — and what it never sends

When a prompt starts with a trigger from your `tools` map (e.g. `/weekly-report ...`), the hook POSTs exactly this to your PositiveROI server:

```json
{
  "tool": "the-tool-slug",
  "occurred_at": "2026-01-01T00:00:00.000Z",
  "source": "hook",
  "idempotency_key": "hook:<session_id>:<first 16 hex chars of sha256(prompt)>",
  "metadata": { "surface": "claude-code" }
}
```

It **never** sends:

- your prompt text, or any substring of it (only a one-way hash fragment, used to deduplicate)
- command arguments
- file paths or contents
- your working directory
- environment variables or their values

The hook also never writes to your conversation (stdout stays empty) and never blocks a prompt — on any failure it exits silently.

## Offline behavior

If your PositiveROI server is unreachable, the run is queued in `~/.positiveroi/queue.ndjson` (capped at 1MB, oldest entries dropped first) and sent automatically on a later prompt. Idempotency keys make replays safe — nothing is ever double-counted.

## Configuration

`~/.positiveroi/config.json`:

```json
{
  "endpoint": "https://roi.example.com",
  "apiKey": "roi_ingest_...",
  "tools": { "weekly-report": "weekly-report-generator" },
  "hookCaptured": ["weekly-report-generator"]
}
```

- `tools` — slash-command trigger → registered tool slug; drives the capture hook.
- `hookCaptured` — slugs the hook logs automatically; the MCP `log_run` tool refuses these (pass `force: true` only for runs that happened outside Claude Code).
- Environment variables `POSITIVEROI_API_KEY` and `POSITIVEROI_ENDPOINT` override the file's `apiKey`/`endpoint`.
