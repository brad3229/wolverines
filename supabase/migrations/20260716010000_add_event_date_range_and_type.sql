-- Event type and date range (event_date is the start date)
create type drill_event_type as enum ('drill', 'annual_training');

alter table drill_events
  add column event_type drill_event_type not null default 'drill',
  add column end_date date;

update drill_events set end_date = event_date where end_date is null;

alter table drill_events
  alter column end_date set not null,
  add constraint drill_events_end_date_check check (end_date >= event_date);

-- Self check-in should be allowed on any day within the event's range, not just day one
-- (Annual Training participants may not show up until later in the period).
drop policy "attendance_self_checkin" on attendance;

create policy "attendance_self_checkin" on attendance
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and drill_event_id in (
      select id from drill_events where current_date between event_date and end_date
    )
    and status in ('present', 'late')
  );
