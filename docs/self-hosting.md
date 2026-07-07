# Self-hosting

The whole platform is one Next.js app and one Supabase project. You need: a Supabase project (free tier works), somewhere to run Next.js (Vercel free tier works), and about twenty minutes.

**No telemetry.** A self-hosted PositiveROI sends nothing to us or anyone else. No phone-home, no usage pings, no update checks. Your runs and numbers stay in your Postgres.

## 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) and create a new project. Pick a strong database password and a region near your users.
2. From Project Settings → API, note three values: the **Project URL**, the **anon key**, and the **service_role key**. The service_role key bypasses row-level security; treat it like a root password and never expose it to a browser.

> **Free-tier warning:** Supabase pauses free projects after about a week of inactivity. A paused project means your dashboard and ingestion stop until you unpause it. For anything real, use a paid Supabase project or check in on it.

## 2. Apply the database schema

The schema lives in `supabase/migrations/` as plain SQL, numbered in order. Those files are canonical; apply them and you have the full database, including row-level security.

With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or apply the files manually, in filename order, with `psql` against your database connection string:

```bash
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

## 3. Set environment variables

Copy `.env.example` in the repo root and fill it in. `.env.example` is the canonical list; the important ones:

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon key (safe for browsers; RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | The service_role key. Server-only, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_DEPLOYMENT` | Set to `self-hosted` |
| `HOSTED_ADMIN_EMAILS` | Leave unset; only used on the hosted service |

Setting `NEXT_PUBLIC_DEPLOYMENT=self-hosted` does three things: the pricing page disappears, the `/admin` route 404s, and the landing page CTA points at your own deployment instead of hosted signup.

## 4. Deploy the app

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fstavcharkham%2Fpositiveroi)

Or manually: import the repo into Vercel, set the root directory to `apps/web`, add the environment variables from step 3, and deploy. Any platform that runs Next.js works; Vercel is just the zero-config path.

Running locally instead:

```bash
pnpm install
pnpm dev
```

## 5. Configure auth

**Magic links work out of the box** with no configuration: Supabase emails a sign-in link. Two things to know:

- In Supabase → Authentication → URL Configuration, set the **Site URL** to your deployment URL and add `https://your-domain/auth/callback` to the redirect URLs. Otherwise magic links bounce to localhost.
- Supabase's built-in email sender is rate-limited to a handful of emails per hour on the free tier, which is fine for trying it out and not fine for a team. For real use, configure custom SMTP (Supabase → Authentication → SMTP settings) with any provider (Resend, Postmark, SES).

**Google OAuth is optional.** If you want it: create an OAuth client in Google Cloud Console (type: Web application) with the redirect URI `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`, then paste the client ID and secret into Supabase → Authentication → Providers → Google. The login page picks it up automatically once the provider is enabled.

## 6. Verify

1. Open your deployment, sign up, create a workspace. Onboarding shows your ingest key once; copy it.
2. Register a tool in the wizard.
3. Log a run:

```bash
curl -X POST https://your-domain/api/ingest \
  -H "Authorization: Bearer roi_ingest_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "your-tool-slug"}'
```

Refresh your dashboard. The run is there. That is the whole loop; everything else (public page, badge, read API) is configuration on top.

## Upgrading

Pull the repo, apply any new files in `supabase/migrations/` (they are append-only), redeploy. Aggregates are computed on the fly, so there are no rollup jobs to migrate; below roughly a million events a year you will not need one.
