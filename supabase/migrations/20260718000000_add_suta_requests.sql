-- SUTA requests: a Soldier's request to be excused from a specific drill/AT event,
-- with admin approval and make-up tracking once approved.
create type suta_status as enum ('pending', 'approved', 'denied');
create type makeup_status as enum ('not_required', 'pending', 'completed');

create table suta_requests (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  drill_event_id uuid not null references drill_events (id) on delete cascade,
  reason text not null,
  status suta_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  makeup_status makeup_status not null default 'not_required',
  makeup_notes text,
  makeup_completed_at timestamptz
);

alter table suta_requests enable row level security;

create policy "suta_requests_admin_all" on suta_requests
  for all using (is_admin()) with check (is_admin());

create policy "suta_requests_select_own" on suta_requests
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );

create policy "suta_requests_insert_own" on suta_requests
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
