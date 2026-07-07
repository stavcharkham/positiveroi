create table events (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  tool_id            uuid not null references tools(id) on delete cascade,
  occurred_at        timestamptz not null default now(),   -- bounds enforced in app layer
  received_at        timestamptz not null default now(),
  source             event_source not null default 'rest',
  is_test            boolean not null default false,       -- excluded from every aggregate
  minutes_saved      numeric(8,2) not null check (minutes_saved >= 0 and minutes_saved <= 480),
  minutes_overridden boolean not null default false,
  idempotency_key    text check (char_length(idempotency_key) <= 128),
  metadata           jsonb not null default '{}' check (pg_column_size(metadata) <= 8192),
  api_key_id         uuid references api_keys(id) on delete set null,
  created_by         uuid references auth.users(id)        -- set for source = 'manual'
);
create unique index events_idem_uq on events (tool_id, idempotency_key)
  where idempotency_key is not null;
create index events_ws_time_idx   on events (workspace_id, occurred_at desc) where is_test = false;
create index events_tool_time_idx on events (tool_id, occurred_at desc);

create table metric_definitions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name         text not null,
  unit         metric_unit not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, key)
);
-- Seeded at workspace creation (server action): revenue_influenced (currency),
-- leads_generated (count), client_touchpoints (count).

create table metric_values (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id     uuid not null references events(id) on delete cascade,
  metric_id    uuid not null references metric_definitions(id) on delete cascade,
  occurred_at  timestamptz not null,
  value        numeric(14,2) not null,
  unique (event_id, metric_id)
);
create index metric_values_rollup_idx on metric_values (workspace_id, metric_id, occurred_at desc);

-- Workspace-consistency trigger: defense in depth behind the server-only write path.
create function app.assert_mv_consistent() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from events e
                 where e.id = new.event_id and e.workspace_id = new.workspace_id)
  or not exists (select 1 from metric_definitions md
                 where md.id = new.metric_id and md.workspace_id = new.workspace_id) then
    raise exception 'metric value crosses workspace boundary';
  end if;
  return new;
end $$;
create trigger metric_values_consistency before insert or update on metric_values
  for each row execute function app.assert_mv_consistent();
