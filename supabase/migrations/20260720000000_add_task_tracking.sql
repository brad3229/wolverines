-- Custom task tracking: an admin defines a named task list (e.g. "PHA") made up of
-- stations/steps, and tracks each soldier's completion of every station. A soldier can
-- self-report a station done; an admin must verify it before it counts as complete --
-- mirrors the self-report -> admin-review pattern used for attendance and SUTA.
create type task_completion_status as enum ('incomplete', 'self_reported', 'verified');

create table task_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table task_items (
  id uuid primary key default gen_random_uuid(),
  task_list_id uuid not null references task_lists (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table soldier_task_completions (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  task_item_id uuid not null references task_items (id) on delete cascade,
  status task_completion_status not null default 'incomplete',
  reported_by uuid references profiles (id),
  reported_at timestamptz,
  verified_by uuid references profiles (id),
  verified_at timestamptz,
  notes text,
  unique (soldier_id, task_item_id)
);

alter table task_lists enable row level security;
alter table task_items enable row level security;
alter table soldier_task_completions enable row level security;

-- task_lists
create policy "task_lists_admin_all" on task_lists
  for all using (is_admin()) with check (is_admin());

create policy "task_lists_select_all" on task_lists
  for select using (true);

-- task_items
create policy "task_items_admin_all" on task_items
  for all using (is_admin()) with check (is_admin());

create policy "task_items_select_all" on task_items
  for select using (true);

-- soldier_task_completions
create policy "soldier_task_completions_admin_all" on soldier_task_completions
  for all using (is_admin()) with check (is_admin());

create policy "soldier_task_completions_select_own" on soldier_task_completions
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );

create policy "soldier_task_completions_insert_own" on soldier_task_completions
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and status = 'self_reported'
    and verified_by is null
    and verified_at is null
  );

-- Soldiers may flip their own row between incomplete and self_reported (reporting a
-- station done, or retracting that report) but never touch a row already verified,
-- and never set the verified_by/verified_at fields themselves.
create policy "soldier_task_completions_update_own" on soldier_task_completions
  for update using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and status <> 'verified'
  ) with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and status in ('incomplete', 'self_reported')
    and verified_by is null
    and verified_at is null
  );
