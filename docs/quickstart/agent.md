# Quickstart: agents

For agents running in any MCP client: give the agent the PositiveROI MCP server and it can register tools and log its own runs.

## Configure

The MCP server reads its connection from the environment:

```bash
POSITIVEROI_API_KEY=roi_ingest_YOUR_KEY
POSITIVEROI_ENDPOINT=https://positiveroi.vercel.app
```

Environment variables win over the config file (`~/.positiveroi/config.json`); either works. The key must be **ingest** scope.

Add the server to your MCP client config (stdio transport). Inside Claude Code, the plugin already bundles it; for other clients, run the server binary from this repo (see [docs/mcp-server.md](../mcp-server.md) for the exact command and post-npm `npx` form).

## What the agent can do

The server exposes four tools:

- `register_tool`: register a new tool with the conservative baseline interview values; returns the credited minutes with the full methodology string.
- `log_run`: log one run after the work completes; returns the owner's trailing-30-day hours and Multiplier progress, so the agent can say "logged — you're at 62% of your Multiplier badge."
- `list_tools`: resolve tool slugs.
- `get_summary`: workspace totals: runs, hours, active tools, builders.

## A typical agent flow

1. Agent finishes a unit of work (a digest sent, a ticket triaged).
2. Agent calls `log_run` with the tool slug and, optionally, a metrics map:

```json
{ "tool": "ticket-triage", "metrics": { "client_touchpoints": 1 } }
```

3. The response includes the run status and progress numbers the agent can narrate.

Runs logged this way land with `source: "mcp"`, so the dashboard shows exactly which capture path produced them.

One guard to know about: if a tool is marked hook-captured in the local config (Claude Code skills set up through the plugin), `log_run` refuses to log it to prevent double-counting. Pass `force: true` only if you know the hook isn't running.

Have the agent complete one task and call `log_run`.

Refresh your dashboard. The run is there.
