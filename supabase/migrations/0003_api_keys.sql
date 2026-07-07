-- Before events: events.api_key_id references this table.
create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null default '',
  scope        api_key_scope not null,
  key_prefix   text not null,                 -- e.g. 'roi_ingest_3fk2' — display only
  key_hash     text not null unique,          -- sha256 hex of the full secret
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index api_keys_ws_idx on api_keys (workspace_id);
