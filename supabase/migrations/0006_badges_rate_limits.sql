create table builder_badges (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  badge        badge_type not null,
  earned_at    timestamptz not null default now(),   -- permanent once earned
  primary key (workspace_id, user_id, badge)
);

create table rate_limits (
  api_key_id   uuid not null references api_keys(id) on delete cascade,
  window_start timestamptz not null,                 -- minute-truncated
  count        integer not null default 1,
  primary key (api_key_id, window_start)
);
