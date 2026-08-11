-- Plain organizational tags for filtering/grouping the roster -- not tied to
-- any RLS/visibility rules. A soldier's own row-level access is unaffected;
-- this is metadata only.
alter table soldiers
  add column platoon text check (platoon in ('1st Platoon', '2nd Platoon', '3rd Platoon', 'HQ Platoon')),
  add column squad text check (squad in ('1st Squad', '2nd Squad', '3rd Squad', '4th Squad')),
  add column team text check (team in ('Alpha Team', 'Bravo Team'));
