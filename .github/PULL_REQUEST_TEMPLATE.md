## What this changes

<!-- One behavior change, described as a user or API caller would notice it. -->

## Why

<!-- Link the issue if there is one. -->

## Checklist

- [ ] `pnpm check` passes locally (lint + typecheck + test + build)
- [ ] No methodology constant changes (the 0.6, the 0.5, the 180 — PRs touching them are declined; open an issue instead)
- [ ] New or changed logic has tests; bug fixes have a regression test
- [ ] If this touches how a number is computed: aggregates still exclude `is_test`, overrides still only lower credit, and the TS/Postgres methodology round-trip test still passes
- [ ] Schema changes are new append-only files in `supabase/migrations/` (no edits to existing migrations)
- [ ] API shape changes update `docs/api/` in the same PR, matching `packages/core/src/schemas.ts`
- [ ] No secrets, keys, or workspace data in code, fixtures, or docs
