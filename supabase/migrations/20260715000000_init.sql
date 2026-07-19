-- Enums
create type user_role as enum ('admin', 'soldier');
create type attendance_status as enum ('present', 'late', 'absent', 'excused');
create type edit_request_status as enum ('pending', 'approved', 'rejected');

-- Profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'soldier',
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created
-- (admin invites a Soldier -> auth.users insert -> profiles insert here)
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'soldier'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Soldiers (roster)
create table soldiers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  rank text not null,
  date_of_rank date not null,
  dod_id text not null,
  ets_date date not null,
  is_nco boolean not null default false,
  last_ncoer_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index soldiers_profile_id_key on soldiers (profile_id) where profile_id is not null;

-- Drill events (calendar)
create table drill_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Attendance
create table attendance (
  id uuid primary key default gen_random_uuid(),
  drill_event_id uuid not null references drill_events (id) on delete cascade,
  soldier_id uuid not null references soldiers (id) on delete cascade,
  status attendance_status not null,
  reason text,
  marked_by uuid references profiles (id),
  marked_at timestamptz not null default now(),
  unique (drill_event_id, soldier_id)
);

-- Edit requests (Soldier-submitted changes, admin-approved)
create table edit_requests (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references soldiers (id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text not null,
  status edit_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz
);

-- Helper: is the current user an admin?
create function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Row Level Security
alter table profiles enable row level security;
alter table soldiers enable row level security;
alter table drill_events enable row level security;
alter table attendance enable row level security;
alter table edit_requests enable row level security;

-- profiles
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());

-- soldiers
create policy "soldiers_admin_all" on soldiers
  for all using (is_admin()) with check (is_admin());

create policy "soldiers_select_own" on soldiers
  for select using (profile_id = auth.uid());

-- drill_events
create policy "drill_events_admin_all" on drill_events
  for all using (is_admin()) with check (is_admin());

create policy "drill_events_select_all" on drill_events
  for select using (true);

-- attendance
create policy "attendance_admin_all" on attendance
  for all using (is_admin()) with check (is_admin());

create policy "attendance_select_own" on attendance
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );

create policy "attendance_self_checkin" on attendance
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and drill_event_id in (select id from drill_events where event_date = current_date)
    and status in ('present', 'late')
  );

-- edit_requests
create policy "edit_requests_admin_all" on edit_requests
  for all using (is_admin()) with check (is_admin());

create policy "edit_requests_select_own" on edit_requests
  for select using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );

create policy "edit_requests_insert_own" on edit_requests
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
  );
