---
name: impact-setup
description: "Connect this machine to PositiveROI — store the workspace ingest key and verify the connection. Use when the user wants to set up impact tracking / connect PositiveROI."
---

# PositiveROI Setup

Connect this machine to the user's PositiveROI workspace, then prove the connection works with live numbers.

## Steps

1. **Ask for the two values** (skip any the user already provided):
   - The **workspace ingest key** — found in the PositiveROI dashboard under **Settings → API Keys**. It starts with `roi_ingest_`. If it starts with `roi_read_`, that's a read key — ask for an ingest key instead.
   - The **endpoint URL** — the base URL of their PositiveROI server, e.g. `https://roi.example.com` (no trailing path).

2. **Write `~/.positiveroi/config.json` — merge, don't clobber.**
   Read the existing file first if it exists. Set `endpoint` and `apiKey` to the new values, and preserve any existing `tools` and `hookCaptured` entries untouched:

   ```json
   {
     "endpoint": "https://roi.example.com",
     "apiKey": "roi_ingest_...",
     "tools": { "existing-trigger": "existing-slug" },
     "hookCaptured": ["existing-slug"]
   }
   ```

   Create the `~/.positiveroi` directory if it doesn't exist. Never print the full key back into the conversation — refer to it as `roi_ingest_...`.

3. **Verify LIVE — evidence, not "should work".**
   Call the `get_summary` tool from the **positiveroi** MCP server. The server re-reads the config on every call, so no restart is needed.
   - On success, report the workspace's actual current numbers: workspace name, runs and credited hours in the last 30 days, active tools, builders. That live response is the proof the connection works.
   - On failure, report the exact error and fix the likely cause: a `401` means the key is wrong (re-copy it from Settings → API Keys); an unreachable-server error means the endpoint URL is wrong. Fix and verify again — do not declare setup done until `get_summary` returns real data.

4. **Point at next steps.** Suggest running the `register-tool` skill when they finish building a tool they want tracked.
