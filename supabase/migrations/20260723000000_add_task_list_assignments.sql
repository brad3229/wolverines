-- Task lists were implicitly assigned to every active Soldier -- no way to hand a task
-- list (e.g. a one-off requirement) to just one Soldier or a subset of the platoon.
-- assigned_to_all keeps that as the default so existing lists behave unchanged; when it's
-- false, task_list_assignments defines exactly who the list applies to.
alter table task_lists
  add column assigned_to_all boolean not null default true;

create table task_list_assignments (
  id uuid primary key default gen_random_uuid(),
  task_list_id uuid not null references task_lists (id) on delete cascade,
  soldier_id uuid not null references soldiers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_list_id, soldier_id)
);

alter table task_list_assignments enable row level security;

create policy "task_list_assignments_admin_all" on task_list_assignments
  for all using (is_admin()) with check (is_admin());

-- Soldiers need to read their own assignment rows so the app can filter which
-- non-platoon-wide task lists to show them.
create policy "task_list_assignments_select_own" on task_list_assignments
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
