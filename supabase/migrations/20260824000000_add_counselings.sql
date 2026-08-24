-- DA Form 4856 developmental counseling records. Authored by cadre after (or
-- during) a counseling session, not submitted by the Soldier -- same shape as
-- aft_tests: no status/review workflow, just admin_all (write) + select_own
-- (read). The Soldier's own agree/disagree and signature happen on paper (or
-- the generated PDF) at the moment of the actual counseling, not in-app.
create table counselings (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  session_date date not null,
  organization text not null default 'A CO 1-120 IN',
  counselor_name text not null,
  purpose text not null,
  key_points text not null,
  plan_of_action text not null,
  leader_responsibilities text,
  individual_remarks text,
  assessment text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table counselings enable row level security;

create policy "counselings_admin_all" on counselings
  for all using (is_admin()) with check (is_admin());

create policy "counselings_select_own" on counselings
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
