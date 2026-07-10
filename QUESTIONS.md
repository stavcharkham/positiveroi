# QUESTIONS: open items for Stav

Blocking items first. Each has the exact steps so it can be done in one sitting.

## 1. Credited-number edit bounds (blocks the adjustments batch)

Decided 2026-07-10: the final credited minutes/run is editable — the Undercount becomes a suggested default with an explanation, not a lock. One sub-decision remains: how far can a builder move the number? Options presented in chat (cap at baseline with honest labeling above the suggestion, downward-only, or fully free).

## 2. Google OAuth client (optional — deferred by Stav 2026-07-10)

Magic-link login works without it. Steps preserved for later:

1. [console.cloud.google.com](https://console.cloud.google.com) → create project `PositiveROI`.
2. **APIs & Services → OAuth consent screen** → External, app name `PositiveROI`, support email, save through (no scopes).
3. **Credentials → Create Credentials → OAuth client ID** → Web application.
4. Authorized redirect URI, exactly: `https://mzkvhihqykzeecbwoigu.supabase.co/auth/v1/callback`
5. Copy Client ID + Secret → Supabase **Authentication → Providers → Google** → enable, paste, save.

The login page shows the Google button automatically once the provider is on; no code change.

## Later (not blocking)

- **Buy positiveroi.dev** and point it at the Vercel project.
- **Create the npm org** `positiveroi` (or confirm `@positiveroi` scope) so core/sdk/mcp-server can publish; release workflow ready, just disabled.
- **Stripe** account + when the $29 tier gets enforced (v1 pricing is copy only).

## Resolved (log)

**2026-07-10, second review round:**
- Service role key: pasted locally by Stav; all 54 tests green including the 7 live-Supabase ones.
- Vercel: Stav authenticated the Vercel connector; Claude creates the project at release.
- Upgrade contact email: stav@verticalbuilders.dev (applied to pricing page + settings plan card).
- "Builder" FAQ definition: "The person who built the tools." (applied).
- Repo moved to `~/Desktop/cool-projects/positiveroi` at Stav's request.
- API keys become **user-level**: every member manages their own keys, admins see all; offboarding = revoke that person's keys, nobody else rotates anything.
- MCP gets a `list_metrics` tool so building agents can discover the admin-defined business KPIs before logging runs.

**2026-07-10, first round:**
- Builders CAN edit the baseline before approving (wizard already works this way).
- MCP server for building agents exists (`register_tool`, `log_run`, `list_tools`, `get_summary`).
- Leaderboards rank by credited (undercounted) hours per builder / per tool. Confirmed.
- Time ranges: last 7 / last 30 / last 90 days / custom range (queued: rename quarter→90 days, add custom picker).
- `/admin` allowed emails: stav@verticalbuilders.dev, stavchark@gmail.com (set in local env; goes to Vercel env at release).
