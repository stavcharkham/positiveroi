create table workspaces (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 80),
  slug              text not null unique
                      check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  timezone          text not null default 'UTC',
  hourly_rate_cents integer not null default 6000 check (hourly_rate_cents between 0 and 100000000),
  currency          char(3) not null default 'USD',
  public_enabled    boolean not null default false,
  public_slug       text unique
                      check (public_slug is null or public_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  public_config     jsonb not null default '{"show_tools": true, "show_builders": false, "show_money": false}',
  created_at        timestamptz not null default now()
);

create function app.assert_valid_tz() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform now() at time zone new.timezone;   -- raises on invalid IANA name
  return new;
end $$;
create trigger workspaces_tz_check before insert or update of timezone
  on workspaces for each row execute function app.assert_valid_tz();

create table members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'builder',
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_user_idx on members (user_id);

-- v1: link invites only (email column parked for v1.1 email invites)
create table invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text,                          -- always null in v1
  role         member_role not null default 'builder',
  token_hash   text not null unique,          -- sha256 of the invite token
  max_uses     integer not null default 25 check (max_uses between 1 and 500),
  use_count    integer not null default 0,
  created_by   uuid not null references auth.users(id),
  expires_at   timestamptz not null default now() + interval '14 days',
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index invites_ws_idx on invites (workspace_id);
