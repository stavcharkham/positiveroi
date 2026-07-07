# Quickstart: Claude Code skills

If your tool is a Claude Code skill, you don't log runs at all. The PositiveROI plugin captures them automatically.

## Install the plugin

In Claude Code:

```
/plugin marketplace add stavcharkham/positiveroi
/plugin install positiveroi@positiveroi
```

## Connect your workspace

```
/positiveroi:impact-setup
```

The setup skill walks you through it: open your dashboard, go to Settings → API Keys, create an ingest key, paste it into the chat. It writes `~/.positiveroi/config.json` and then verifies the connection live, for example: "Connected — your workspace has 3 tools and 41 hours measured."

## Register your skill

```
/positiveroi:register-tool
```

This is a short methodology interview in chat: what does the skill do, how many manual minutes does one run conservatively replace, does a human decision remain. It shows the Receipt math out loud (45 × 0.6 × 0.5 = 13.5 credited min/run), registers the tool, and maps your skill's trigger phrase to the tool slug in your local config.

From that point, every time you invoke the skill, the run is logged. Nothing to remember.

## How the hook works (and what it sends)

The plugin installs a `UserPromptSubmit` hook. On every prompt, it checks your local config for a matching registered trigger. No match, or no config: it exits instantly and invisibly.

On a match, it POSTs one event to `/api/ingest` containing **only**:

- the tool slug
- a timestamp
- `source: "hook"`
- an idempotency key built from the session ID and a hash of the prompt (so retries and duplicate hook fires never double-count)
- `metadata: { "surface": "claude-code" }`

**It never sends:** your prompt text or any part of it, skill arguments, file paths, your working directory, or environment values. The idempotency key contains a one-way hash only; the prompt cannot be recovered from it.

If the network is down, the event queues locally in `~/.positiveroi/queue.ndjson` and is drained on a later prompt. The hook never blocks your prompt, never writes into your session, and never fails loudly.

## One rule: don't double-log

Tools registered through `register-tool` are marked as hook-captured in your config. The MCP `log_run` tool refuses to log them manually (to prevent double-counting) unless you pass `force: true`. The server's idempotency index is the backstop.

Invoke your skill once.

Refresh your dashboard. The run is there.
