# QUESTIONS: open items for Stav

Blocking items first. Each has the exact steps so it can be done in one sitting.

## 1. Create the Google OAuth client (unblocks Google login)

Magic-link login works without this, so it's not launch-blocking, but Google login is the smoother path for teams.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (name: `PositiveROI`).
2. Left menu → **APIs & Services → OAuth consent screen**. Choose **External**, app name `PositiveROI`, add your support email, save through the steps (no scopes to add).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Application type: **Web application**.
4. Under **Authorized redirect URIs**, add exactly: `https://mzkvhihqykzeecbwoigu.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**.
6. In Supabase: **Authentication → Providers → Google** → enable, paste both values, save.

Nothing in the code changes; the login page shows the Google button automatically once the provider is on.

## 2. Vercel production hookup

If the Vercel connector can't create/link the production project from this side, do it once by hand:

1. [vercel.com/new](https://vercel.com/new) → import `stavcharkham/positiveroi`.
2. Root directory: `apps/web`.
3. Add the environment variables from `.env.example` (I'll hand you the filled values for everything except the item below).
4. Deploy. The .vercel.app URL it assigns is our production URL for now.

## 3. SUPABASE_SERVICE_ROLE_KEY handoff

The service-role key bypasses row-level security, so it should pass through as few hands as possible. Grab it from Supabase → **Project Settings → API → service_role**, then put it in two places — never in chat, never in a committed file:

1. **Vercel** → Project → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production).
2. **Locally**: open `apps/web/.env.local` (gitignored) and fill the empty `SUPABASE_SERVICE_ROLE_KEY=` line. This is also what turns on the live integration test suite (`pnpm -F web test` — 7 currently-skipped tests activate automatically) and lets the app run fully on your machine.

## Later (not blocking)

- **Buy positiveroi.dev** and point it at the Vercel project (Vercel → Domains walks you through it).
- **Create the npm org** `positiveroi` (or confirm `@positiveroi` scope availability) so core/sdk/mcp-server can publish; the release workflow is already written and just needs enabling.
- **Stripe** account + decision on when the $29 tier gets enforced (v1 pricing is copy only).
