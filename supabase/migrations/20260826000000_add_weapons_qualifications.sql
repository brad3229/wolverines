-- DA Form 7801 (Rifle, Carbine, and Automatic Rifle Marksmanship Scorecard)
-- Stage I qualification records. Recorded by the Range OIC/cadre after the
-- event, not submitted by the Soldier -- same shape as aft_tests: no
-- status/review workflow, just admin_all (write) + select_own (read).
create table weapons_qualifications (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  qual_date date not null,
  weapon_type text not null,
  equipment_optics text,
  lane_firing_order text,
  table_type text not null check (table_type in ('practice', 'qualification')),
  phase1_hits integer,
  phase2_hits integer,
  phase3_hits integer,
  phase4_hits integer,
  total_hits integer,
  qualification_rating text check (qualification_rating in ('expert', 'sharpshooter', 'marksman', 'unqualified')),
  range_oic_name text,
  remarks text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table weapons_qualifications enable row level security;

create policy "weapons_qualifications_admin_all" on weapons_qualifications
  for all using (is_admin()) with check (is_admin());

create policy "weapons_qualifications_select_own" on weapons_qualifications
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
