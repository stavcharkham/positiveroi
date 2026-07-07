create table tools (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  owner_id              uuid not null references auth.users(id),
  name                  text not null check (char_length(name) between 1 and 100),
  slug                  text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$'),
  description           text not null default '',
  type                  tool_type not null,
  status                tool_status not null default 'active',
  origin                text not null default 'dashboard' check (origin in ('dashboard','api')),
  raw_estimate_minutes  numeric(8,2) not null
                          check (raw_estimate_minutes > 0 and raw_estimate_minutes <= 480),
  high_judgment         boolean not null default false,
  -- The Undercount, computed once, here. Mirrored by @positiveroi/core
  -- computeMinutesSavedPerRun — a round-trip test keeps them identical.
  minutes_saved_per_run numeric(8,2) generated always as (
      round(raw_estimate_minutes * 0.6
            * case when high_judgment then 0.5 else 1.0 end, 2)
  ) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index tools_ws_idx    on tools (workspace_id, status);
create index tools_owner_idx on tools (workspace_id, owner_id);

-- Bare audit: who set/changed the baseline, when.
create table baseline_history (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  tool_id           uuid not null references tools(id) on delete cascade,
  changed_by        uuid references auth.users(id),
  old_raw_estimate  numeric(8,2),              -- null on creation row
  new_raw_estimate  numeric(8,2) not null,
  old_high_judgment boolean,
  new_high_judgment boolean not null,
  changed_at        timestamptz not null default now()
);
create index baseline_history_tool_idx on baseline_history (tool_id, changed_at desc);
