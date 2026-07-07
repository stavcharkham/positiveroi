create function app.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (select 1 from members where workspace_id = ws and user_id = auth.uid()) $$;

create function app.member_role(ws uuid) returns member_role
language sql stable security definer set search_path = public, pg_temp as
$$ select role from members where workspace_id = ws and user_id = auth.uid() $$;

alter table workspaces         enable row level security;
alter table members            enable row level security;
alter table invites            enable row level security;
alter table api_keys           enable row level security;
alter table tools              enable row level security;
alter table baseline_history   enable row level security;
alter table events             enable row level security;
alter table metric_definitions enable row level security;
alter table metric_values      enable row level security;
alter table builder_badges     enable row level security;
alter table rate_limits        enable row level security;   -- no policies: service-role only

-- RLS is the READ boundary. There are deliberately NO insert/update/delete
-- policies for `authenticated`: every mutation goes through server actions /
-- route handlers using the service-role client behind requireMember().
create policy ws_select    on workspaces         for select to authenticated using (app.is_member(id));
create policy mem_select   on members            for select to authenticated using (app.is_member(workspace_id));
create policy inv_select   on invites            for select to authenticated using (app.member_role(workspace_id) = 'admin');
create policy key_select   on api_keys           for select to authenticated using (app.member_role(workspace_id) = 'admin');
create policy tool_select  on tools              for select to authenticated using (app.is_member(workspace_id));
create policy bh_select    on baseline_history   for select to authenticated using (app.is_member(workspace_id));
create policy ev_select    on events             for select to authenticated using (app.is_member(workspace_id));
create policy md_select    on metric_definitions for select to authenticated using (app.is_member(workspace_id));
create policy mv_select    on metric_values      for select to authenticated using (app.is_member(workspace_id));
create policy badge_select on builder_badges     for select to authenticated using (app.is_member(workspace_id));
-- anon role: zero policies anywhere. Public pages read via the service role
-- through lib/public-gate.ts only.
