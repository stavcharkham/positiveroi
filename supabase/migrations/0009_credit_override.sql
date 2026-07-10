-- Builder-set credit override. The Undercount stays the SUGGESTED number:
-- the minutes_saved_per_run generated column (0004) is untouched and keeps
-- mirroring @positiveroi/core computeMinutesSavedPerRun. A builder may set
-- their own credited minutes per run within (0, 480]; ingest snapshots
-- coalesce(minutes_saved_override, minutes_saved_per_run) into
-- events.minutes_saved, and every surface labels overridden numbers
-- "builder-set". Transparency replaces the hard lock.

alter table tools
  add column minutes_saved_override numeric(8,2)
    check (minutes_saved_override is null
           or (minutes_saved_override >= 0.01 and minutes_saved_override <= 480));

-- Bare audit, mirroring baseline_history (0004): who set, changed, or
-- cleared the credit, and when. old_value null = creation row;
-- new_value null = reset to the suggested Undercount.
create table credit_history (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tool_id      uuid not null references tools(id) on delete cascade,
  changed_by   uuid references auth.users(id),
  old_value    numeric(8,2),
  new_value    numeric(8,2),
  created_at   timestamptz not null default now()
);
create index credit_history_tool_idx on credit_history (tool_id, created_at desc);

-- Same RLS posture as baseline_history (0007): members read, nobody writes.
-- Every mutation goes through server actions on the service-role client.
alter table credit_history enable row level security;
create policy ch_select on credit_history for select to authenticated
  using (app.is_member(workspace_id));

-- roi_* functions (0008) checked: none of their outputs expose the tool's
-- minutes_saved_per_run — every aggregate sums events.minutes_saved, which
-- already snapshots the coalesced credit at ingest time. Nothing to replace.
