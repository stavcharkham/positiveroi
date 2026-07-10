# QUESTIONS: open items for Stav

Blocking items first. Each has the exact steps so it can be done in one sitting.

## 1. SUPABASE_SERVICE_ROLE_KEY handoff (blocks live verification)

The service-role key bypasses row-level security, so it should pass through as few hands as possible. Grab it from Supabase → **Project Settings → API → service_role**, then put it in two places — never in chat, never in a committed file:

1. **Locally**: open `apps/web/.env.local` (gitignored) and fill the empty `SUPABASE_SERVICE_ROLE_KEY=` line. This turns on the live integration test suite (7 currently-skipped tests) and lets the app run fully on your machine.
2. **Vercel** (once the project exists, see #2) → Project → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production).

## 2. Vercel production hookup (blocks release)

1. [vercel.com/new](https://vercel.com/new) → import `stavcharkham/positiveroi`.
2. Root directory: `apps/web`. Create the project; no need to configure anything else.
3. Claude will hand you the exact environment-variable list to paste (it includes `HOSTED_ADMIN_EMAILS=stav@verticalbuilders.dev,stavchark@gmail.com`).
4. The .vercel.app URL it assigns is our production URL for now.

Alternative: authorize the Vercel connector in Claude settings and Claude does this step.

## 3. Contact email for "Contact to upgrade" (pricing page)

Currently points at stavchark@gmail.com because no product address exists. Pick one:
- Keep Gmail (visible to the public)
- **stav@verticalbuilders.dev (recommended)**
- Hold the upgrade button until positiveroi.dev exists and has a real mailbox

## 4. Confirm the pricing FAQ definition of a "builder"

Draft copy says: "a member who owns tools that log runs." This is what "Free up to 5 builders" counts. Confirm or reword.

## 5. Create the Google OAuth client (optional — unblocks Google login)

Magic-link login works without this, so it's not launch-blocking, but Google login is the smoother path for teams.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (name: `PositiveROI`).
2. Left menu → **APIs & Services → OAuth consent screen**. Choose **External**, app name `PositiveROI`, add your support email, save through the steps (no scopes to add).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Application type: **Web application**.
4. Under **Authorized redirect URIs**, add exactly: `https://mzkvhihqykzeecbwoigu.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**.
6. In Supabase: **Authentication → Providers → Google** → enable, paste both values, save.

Nothing in the code changes; the login page shows the Google button automatically once the provider is on.

## Later (not blocking)

- **Buy positiveroi.dev** and point it at the Vercel project (Vercel → Domains walks you through it).
- **Create the npm org** `positiveroi` (or confirm `@positiveroi` scope availability) so core/sdk/mcp-server can publish; the release workflow is already written and just needs enabling.
- **Stripe** account + decision on when the $29 tier gets enforced (v1 pricing is copy only).

## Answered 2026-07-10 (recorded for the log)

- Builders CAN edit the baseline before approving (wizard already works this way); after creation it stays lead/admin-only, audited.
- MCP server for building agents: exists (`register_tool`, `log_run`, `list_tools`, `get_summary`).
- API keys are workspace-level, many allowed; attribution is per tool owner. Confirmed OK.
- Leaderboards rank by credited (undercounted) hours per builder / per tool. Confirmed.
- Time ranges must be: last 7 / last 30 / last 90 days / custom range (queued: rename quarter→90 days, add custom picker).
- `/admin` allowed emails: stav@verticalbuilders.dev, stavchark@gmail.com only.
