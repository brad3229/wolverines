-- In-app notifications so a Soldier finds out when something they submitted (SUTA, edit
-- request, pay issue, task station, self check-in) gets reviewed, instead of having to
-- manually check back. Targeted at profiles (not soldiers) since that's what auth.uid()
-- maps to, and it's cadre/admin actions that create these rows for the affected soldier.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_profile_id_created_at_idx on notifications (profile_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications_admin_all" on notifications
  for all using (is_admin()) with check (is_admin());

create policy "notifications_select_own" on notifications
  for select using (profile_id = auth.uid());

-- Soldiers can only flip their own notifications to read, never edit the content or
-- retarget them to someone else.
create policy "notifications_update_own" on notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
