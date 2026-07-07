# PositiveROI

**Your team is building AI tools. Prove what they're worth.**

PositiveROI gives companies proof of the value their employees create when they build AI tools. Every automation, Claude Code skill, app, and agent reports its runs to one endpoint. The platform turns those runs into credited hours, money value, and a public track record that survives a skeptical CFO.

## Why the numbers can be trusted

Most impact numbers die in the first meeting because someone inflated them. PositiveROI does the opposite. The methodology is called **The Undercount**, and it cuts every claim twice before crediting anything:

1. **Baseline.** The builder states the most conservative estimate of manual minutes one run replaces. Say 45 minutes.
2. **Confidence Cut.** Only 60% of that is ever credited. 45 becomes **27**.
3. **Judgment Cut.** If a human still makes a meaningful decision in the task, credit is halved again. 27 becomes **13.5**.

So a tool that plausibly saves 45 minutes per run gets credit for 13.5. Runs are measured facts; minutes are labeled estimates; and every headline number drills down to the individual runs behind it (we call that drill-down **the Receipt**). When someone challenges the number, it wins.

A builder whose tools produce 180 credited hours in a trailing 30 days has replaced roughly one full-time job. They earn the **Multiplier** badge.

Full write-up: [docs/methodology.md](docs/methodology.md).

## How capture works

Four capture paths, one endpoint. Everything converges on `POST /api/ingest`.

| You built a... | How runs get logged |
|---|---|
| **Automation** (Zapier, Trigger.dev, n8n, cron) | One HTTP POST per run |
| **Claude Code skill** | The PositiveROI plugin logs runs automatically via a hook |
| **App** (internal tool, script, dashboard) | `@positiveroi/sdk`, one function call |
| **Agent** (any MCP client) | The PositiveROI MCP server's `log_run` tool |

Quickstarts: [automation](docs/quickstart/automation.md) · [skill](docs/quickstart/skill-plugin.md) · [app](docs/quickstart/app.md) · [agent](docs/quickstart/agent.md)

## Quickstart (hosted)

1. Sign up and create a workspace. Onboarding hands you an ingest API key (shown once).
2. Register a tool. The wizard walks you through the baseline and shows the Receipt math live.
3. Log your first run:

```bash
curl -X POST https://positiveroi.vercel.app/api/ingest \
  -H "Authorization: Bearer roi_ingest_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "weekly-pipeline-digest", "idempotency_key": "run-'"$(date +%s)"'"}'
```

Refresh your dashboard. The run is there.

## Claude Code plugin

```
/plugin marketplace add stavcharkham/positiveroi
/plugin install positiveroi@positiveroi
```

Then run `/positiveroi:impact-setup` and paste your ingest key when asked. Skills you register are captured automatically from then on; no manual logging. Details: [docs/quickstart/skill-plugin.md](docs/quickstart/skill-plugin.md).

## Read API

Pull your numbers into any BI tool with a read-scoped key:

```bash
curl -H "Authorization: Bearer roi_read_YOUR_KEY" \
  "https://positiveroi.vercel.app/api/v1/stats?period=month"
```

Returns runs, credited hours, FTE equivalent, and money value for the period. Reference: [docs/api/read-api.md](docs/api/read-api.md) and [docs/api/ingestion.md](docs/api/ingestion.md).

## Self-hosting

The whole platform is one Next.js app plus one Supabase project. MIT licensed, self-hostable from this repo. Guide: [docs/self-hosting.md](docs/self-hosting.md).

**No telemetry.** Self-hosted deployments send nothing back to us. No phone-home, no usage pings, no exceptions.

## What's in the repo

```
apps/web/               The Next.js app: dashboard, public pages, all API routes
packages/core/          Constants, The Undercount methodology, zod schemas, snippets
packages/sdk/           @positiveroi/sdk - tiny client for apps
packages/mcp-server/    @positiveroi/mcp-server - MCP tools for agents
packages/claude-plugin/ Claude Code plugin: capture hook, skills, vendored MCP server
supabase/migrations/    The full database schema, applied in order
docs/                   Methodology, quickstarts, API reference, self-hosting
```

Architecture deep dive: [docs/architecture.md](docs/architecture.md).

## License

MIT. See [LICENSE](LICENSE). Contributions welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) first, especially the part about methodology constants.

---

Built in public by [Stav Charkham](https://github.com/stavcharkham).
