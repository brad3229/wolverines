-- Monthly unit readiness history, for the trend chart on the admin Dashboard.
-- There's no cron/scheduler in this project, so a month's row is captured
-- lazily: the app upserts the current month's numbers every time an admin
-- loads the Dashboard, and simply stops touching a month's row once the
-- calendar rolls past it. That keeps the current month live and every past
-- month frozen as real history -- nothing here is backfilled or estimated.
create table readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  deployable_pct integer not null,
  go_count integer not null,
  at_risk_count integer not null,
  no_go_count integer not null,
  total_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table readiness_snapshots enable row level security;

create policy "readiness_snapshots_admin_all" on readiness_snapshots
  for all using (is_admin()) with check (is_admin());
