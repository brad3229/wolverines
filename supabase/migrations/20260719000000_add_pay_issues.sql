-- Pay issues: a Soldier-reported pay problem (missing/incorrect pay, LES errors, etc.),
-- tracked through an admin review queue until resolved. Mirrors the suta_requests pattern.
create type pay_issue_category as enum ('missing_pay', 'incorrect_amount', 'les_error', 'allotment_issue', 'other');
create type pay_issue_status as enum ('open', 'in_progress', 'resolved');

create table pay_issues (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  category pay_issue_category not null,
  description text not null,
  status pay_issue_status not null default 'open',
  reported_at timestamptz not null default now(),
  resolved_by uuid references profiles (id),
  resolved_at timestamptz,
  resolution_notes text
);

alter table pay_issues enable row level security;

create policy "pay_issues_admin_all" on pay_issues
  for all using (is_admin()) with check (is_admin());

create policy "pay_issues_select_own" on pay_issues
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );

create policy "pay_issues_insert_own" on pay_issues
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
