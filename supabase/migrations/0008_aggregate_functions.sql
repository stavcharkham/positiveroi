-- Aggregate functions backing apps/web/src/lib/aggregates.ts.
-- SECURITY INVOKER (the default): called via the service role from the
-- server, so reads bypass RLS there; if an authenticated user ever calls
-- them through PostgREST, RLS still scopes every row they can see, and
-- anon sees nothing. EVERY aggregate filters is_test = false and derives
-- from sum(events.minutes_saved) — never recomputed from tool baselines.
-- All time filtering is on occurred_at: from inclusive, to exclusive.

create function roi_workspace_stats(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (runs bigint, minutes numeric, active_tools int, builders int)
language sql stable set search_path = public, pg_temp as $$
  select count(e.id)::bigint,
         coalesce(sum(e.minutes_saved), 0)::numeric,
         count(distinct e.tool_id)::int,
         count(distinct t.owner_id)::int
  from events e
  join tools t on t.id = e.tool_id
  where e.workspace_id = ws
    and e.is_test = false
    and e.occurred_at >= p_from and e.occurred_at < p_to
$$;

-- Credited MINUTES in the window for tools owned by p_owner
-- (the TS wrapper divides by 60).
create function roi_builder_hours(ws uuid, p_owner uuid, p_from timestamptz, p_to timestamptz)
returns numeric
language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(e.minutes_saved), 0)::numeric
  from events e
  join tools t on t.id = e.tool_id
  where e.workspace_id = ws
    and t.owner_id = p_owner
    and e.is_test = false
    and e.occurred_at >= p_from and e.occurred_at < p_to
$$;

create function roi_timeseries(
  ws uuid, p_bucket text, p_from timestamptz, p_to timestamptz, p_tool uuid default null
)
returns table (bucket_start timestamptz, runs bigint, minutes numeric)
language plpgsql stable set search_path = public, pg_temp as $$
begin
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'invalid bucket %, expected day/week/month', p_bucket;
  end if;
  return query
    select date_trunc(p_bucket, e.occurred_at),
           count(e.id)::bigint,
           coalesce(sum(e.minutes_saved), 0)::numeric
    from events e
    where e.workspace_id = ws
      and e.is_test = false
      and e.occurred_at >= p_from and e.occurred_at < p_to
      and (p_tool is null or e.tool_id = p_tool)
    group by 1
    order by 1;
end $$;

-- Departed members left-join to display_name '' — render as "former member".
create function roi_leaderboard_builders(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, display_name text, minutes numeric, runs bigint)
language sql stable set search_path = public, pg_temp as $$
  select t.owner_id,
         coalesce(m.display_name, ''),
         coalesce(sum(e.minutes_saved), 0)::numeric,
         count(e.id)::bigint
  from events e
  join tools t on t.id = e.tool_id
  left join members m on m.workspace_id = ws and m.user_id = t.owner_id
  where e.workspace_id = ws
    and e.is_test = false
    and e.occurred_at >= p_from and e.occurred_at < p_to
  group by t.owner_id, m.display_name
  order by 3 desc
$$;

create function roi_leaderboard_tools(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (tool_id uuid, name text, slug text, minutes numeric, runs bigint)
language sql stable set search_path = public, pg_temp as $$
  select t.id, t.name, t.slug,
         coalesce(sum(e.minutes_saved), 0)::numeric,
         count(e.id)::bigint
  from events e
  join tools t on t.id = e.tool_id
  where e.workspace_id = ws
    and e.is_test = false
    and e.occurred_at >= p_from and e.occurred_at < p_to
  group by t.id
  order by 4 desc
$$;

create function roi_metric_totals(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (metric_id uuid, key text, name text, unit text, total numeric)
language sql stable set search_path = public, pg_temp as $$
  select md.id, md.key, md.name, md.unit::text,
         coalesce(sum(mv.value), 0)::numeric
  from metric_values mv
  join metric_definitions md on md.id = mv.metric_id
  join events e on e.id = mv.event_id
  where mv.workspace_id = ws
    and e.is_test = false
    and mv.occurred_at >= p_from and mv.occurred_at < p_to
  group by md.id
  order by md.name
$$;

-- Active tools with at least one prior (non-test) run but none in 14 days.
create function roi_gone_quiet(ws uuid)
returns table (tool_id uuid, name text, slug text, owner_id uuid, last_run_at timestamptz)
language sql stable set search_path = public, pg_temp as $$
  select t.id, t.name, t.slug, t.owner_id, max(e.occurred_at)
  from tools t
  join events e on e.tool_id = t.id and e.is_test = false
  where t.workspace_id = ws
    and t.status = 'active'
  group by t.id
  having max(e.occurred_at) < now() - interval '14 days'
  order by max(e.occurred_at) asc
$$;

-- Per-tool rollups for the read-scope tools list.
create function roi_tool_stats(ws uuid)
returns table (tool_id uuid, runs_30d bigint, minutes_all_time numeric, last_run_at timestamptz)
language sql stable set search_path = public, pg_temp as $$
  select e.tool_id,
         (count(e.id) filter (where e.occurred_at >= now() - interval '30 days'))::bigint,
         coalesce(sum(e.minutes_saved), 0)::numeric,
         max(e.occurred_at)
  from events e
  where e.workspace_id = ws
    and e.is_test = false
  group by e.tool_id
$$;

-- Fixed-window rate limiting: atomic upsert-increment returning the count
-- for this key + minute window. ~1% of calls also sweep windows older than
-- an hour so the table stays tiny without a cron.
create function roi_rate_limit_hit(p_key uuid, p_window timestamptz)
returns integer
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  insert into rate_limits (api_key_id, window_start, count)
  values (p_key, p_window, 1)
  on conflict (api_key_id, window_start)
  do update set count = rate_limits.count + 1
  returning rate_limits.count into v_count;

  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_count;
end $$;

-- The write-path counter is service-role only; keep it away from client roles.
revoke execute on function roi_rate_limit_hit(uuid, timestamptz) from public, anon, authenticated;
