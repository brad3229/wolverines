-- Army Fitness Test tracking. AFT scores are recorded by cadre after grading
-- the event, not submitted by the Soldier -- so unlike SUTA/gear requests
-- there's no soldier-initiated insert/update path at all, just admin_all
-- (write) and select_own (read).

alter table soldiers
  add column sex text check (sex in ('male', 'female'));

create table aft_tests (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  test_date date not null,
  standard text not null check (standard in ('combat', 'general')),
  aoc_mos text,
  rank_at_test text,
  age integer,
  deadlift_lbs integer,
  deadlift_points integer,
  pushup_reps integer,
  pushup_points integer,
  -- Times stored as entered (e.g. "3:15") rather than seconds -- there's no
  -- arithmetic done on them, and it keeps admin entry and the PDF fill both
  -- a direct passthrough of what's on the scorecard.
  sdc_time text,
  sdc_points integer,
  plank_time text,
  plank_points integer,
  run_event_type text not null default 'two_mile_run'
    check (run_event_type in ('two_mile_run', 'row_5k', 'swim_1k', 'bike_12k', 'walk_2_5mi')),
  run_event_time text,
  run_event_points integer,
  total_points integer,
  overall_result text check (overall_result in ('go', 'nogo')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table aft_tests enable row level security;

create policy "aft_tests_admin_all" on aft_tests
  for all using (is_admin()) with check (is_admin());

create policy "aft_tests_select_own" on aft_tests
  for select using (soldier_id in (select id from soldiers where profile_id = auth.uid()));
