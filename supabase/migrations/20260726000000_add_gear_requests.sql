-- Gear requests: a Soldier-reported gear need (initial issue for a new arrival, or a
-- replacement for lost/damaged/wrong-size items), tracked through an admin review queue
-- until resolved. Mirrors the pay_issues pattern.
create type gear_request_category as enum ('initial_issue', 'missing_lost', 'damaged', 'wrong_size', 'other');
create type gear_request_status as enum ('open', 'in_progress', 'resolved');

create table gear_requests (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  category gear_request_category not null,
  description text not null,
  status gear_request_status not null default 'open',
  reported_at timestamptz not null default now(),
  resolved_by uuid references profiles (id),
  resolved_at timestamptz,
  resolution_notes text
);

alter table gear_requests enable row level security;

create policy "gear_requests_admin_all" on gear_requests
  for all using (is_admin()) with check (is_admin());

create policy "gear_requests_select_own" on gear_requests
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );

create policy "gear_requests_insert_own" on gear_requests
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
