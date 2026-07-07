# Security Policy

## Reporting a vulnerability

Email **brain@deep33.com**. Do not open a public issue for security problems.

Include what you found, how to reproduce it, and what a caller could reach with it (which workspace's data, which scope). You'll get an acknowledgment within a few days and a fix or a plan before any public disclosure. Good-faith reports are welcome; there is no bounty program yet, but reporters get credited in the fix unless they'd rather not be.

## Rules of engagement

- **No live-exploit testing against the hosted service.** Other people's workspaces and data live there. Reproduce findings against a self-hosted or local deployment instead; the entire stack runs from this repo ([docs/self-hosting.md](docs/self-hosting.md)), so anything reachable in production is reachable on your own instance.
- No denial-of-service testing, no social engineering, no attempts to access data that isn't yours.

## What's most worth probing

The security model is documented in [docs/architecture.md](docs/architecture.md) §10. The load-bearing claims, which is where a real finding would matter most:

- **Workspace isolation.** RLS grants SELECT to workspace members only; the anon role has zero policies; all writes go through one guarded server path. An RLS isolation suite runs in CI on every push, from clean migrations, and is treated as the project's standing security review.
- **Key scopes.** An ingest key must never expose money, per-builder breakdowns, timeseries, or event metadata.
- **The public gate.** Exactly one function serves anonymous reads; disabled or unknown slugs must 404 with no enumeration signal.
- **The plugin hook.** It must never transmit prompt text, file paths, or environment values; fixture tests pin this.

## Supported versions

v1 is the only line; fixes land on `main`. Self-hosters should track `main` and apply new migrations as they appear.
