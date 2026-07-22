-- Soldiers can now undo an accidental self check-in (wrong button, wrong drill) as long as
-- cadre hasn't confirmed it yet. Once confirmed_by is set it's the official record and only
-- an admin (covered by attendance_admin_all) can change or delete it.
create policy "attendance_self_retract" on attendance
  for delete using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and confirmed_by is null
  );
