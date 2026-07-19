-- Self check-in was writing straight to the official attendance record with no
-- verification -- a Soldier could tap "I'm Here" without ever showing up. Split
-- "Soldier claims present" from "cadre confirmed present": self check-in now leaves
-- confirmed_by null, and only an admin marking attendance sets it.
alter table attendance
  add column confirmed_by uuid references profiles (id),
  add column confirmed_at timestamptz;

drop policy "attendance_self_checkin" on attendance;

create policy "attendance_self_checkin" on attendance
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and drill_event_id in (
      select id from drill_events where current_date between event_date and end_date
    )
    and status in ('present', 'late')
    and confirmed_by is null
  );
