---
name: register-tool
description: "Register the tool you just built so its runs count — guided conservative time-saved interview. Use when a builder finishes building a tool or asks to track a new tool."
---

# Register a Tool with PositiveROI

Interview the builder, register the tool through the PositiveROI MCP server, and wire up automatic run capture. The methodology is deliberately conservative — steer every estimate DOWN, never up.

## The interview

Ask one question at a time:

1. **What does the tool do?** Derive a short, clear name from the answer (confirm it), and pick the type:
   - `automation` — runs by itself (webhook, cron, workflow)
   - `skill` — a Claude Code skill or slash command someone invokes
   - `agent` — an autonomous agent that does the work
   - `app` — an application people use directly

2. **"How many minutes did one round of this take by hand, before the tool existed?"**
   If they're unsure between two numbers, take the LOWER one — undercounting is the point; the number only has to be defensible. This path caps at 120 minutes; if the honest baseline is bigger, register it here at 120 and tell them to raise it in the dashboard, where a lead signs off.

3. **"Does a human still make a judgment call in this task — review, approve, decide?"**
   If yes, `high_judgment: true` (credit is halved, and that's correct — the tool didn't replace the whole job).

## Register and show the math

Call the `register_tool` tool on the **positiveroi** MCP server with the answers. Then show the builder the returned methodology string **verbatim** — it is the receipt for how their credited minutes-per-run were computed (baseline → confidence cut → judgment cut). Do not paraphrase the math.

If the response says the tool is already registered, stop and tell them — runs are logged with `log_run`, not by re-registering.

## Wire up automatic capture

If the tool runs in Claude Code via a slash command, edit `~/.positiveroi/config.json` (merge — never clobber existing entries):

1. Ask which slash command triggers the tool (e.g. `/weekly-report`). Add the trigger (without the leading `/`) to the `tools` map, pointing at the slug returned by registration:

   ```json
   {
     "tools": { "weekly-report": "the-returned-slug" },
     "hookCaptured": ["the-returned-slug"]
   }
   ```

2. Add the slug to `hookCaptured` as well. This does two things: the plugin hook logs a run automatically every time the command is used, and the MCP `log_run` tool refuses that slug so nothing is double-counted.

For tools that run outside Claude Code (apps, webhooks, agents), skip this step — they log runs via the SDK, REST, or MCP instead.

## Close the loop

Tell the builder where the number shows up: their tool and its credited minutes are now on their PositiveROI dashboard, and the first logged run will appear there within seconds of happening. Suggest doing one real run now to see it land.
