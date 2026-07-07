# Contributing

Thanks for wanting to help. PositiveROI is a pnpm + turbo monorepo: the Next.js app in `apps/web`, shared logic in `packages/core`, the SDK, MCP server, and Claude Code plugin alongside it.

## Dev setup

```bash
pnpm install
```

Database, either flavor:

- **Local:** `supabase start` (needs the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker); migrations in `supabase/migrations/` apply automatically.
- **Hosted:** create a free Supabase project and apply the migrations with `supabase db push` (see [docs/self-hosting.md](docs/self-hosting.md)).

Copy `.env.example` to `apps/web/.env.local` and fill in your Supabase values. Then:

```bash
pnpm dev     # run the app
pnpm check   # lint + typecheck + test + build; must pass before any PR
```

## The one hard rule

**PRs changing methodology constants (the 0.6, the 0.5, the 180) will be declined — open an issue instead; the conservatism IS the product.**

The same applies to anything that would let a number inflate: overrides that raise credit, aggregates that include test runs, un-audited baseline edits. If your change touches how a number is computed, expect the review to be strict and to ask for tests.

## PR rules

- Keep PRs small and single-purpose. One behavior change per PR.
- `pnpm check` must be green. CI runs the same command plus the database suite (RLS isolation, idempotency, key auth); those tests are the project's security review, so changes that touch auth, ingest, or RLS need matching tests.
- New logic needs tests next to it. Bug fixes need a regression test that fails without the fix.
- The TypeScript methodology function and the Postgres generated column must stay identical; if you touch either, the round-trip test has to prove they still agree.
- Schema changes are append-only migration files in `supabase/migrations/`; never edit an existing migration.
- Docs live with the change: if you alter an API shape, update `docs/api/` in the same PR (request/response examples in docs must match `packages/core/src/schemas.ts`).
- No new runtime dependencies in `packages/sdk` or the plugin hook; both are meant to stay dependency-free.

## Reporting

- Bugs and feature requests: GitHub issues (templates provided).
- Security issues: **not** issues; see [SECURITY.md](SECURITY.md).

## License

Contributions are accepted under the MIT license, the same as the repo.
