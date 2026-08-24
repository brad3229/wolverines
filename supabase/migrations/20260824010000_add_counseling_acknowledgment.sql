-- Lets the Soldier being counseled actually check the box and sign on their
-- own end, instead of that only being possible on paper -- same typed-name-
-- as-signature pattern already used for the SUTA certificate's acknowledged_at
-- + signature_name pair.
alter table counselings add column acknowledgment text check (acknowledgment in ('agree', 'disagree'));
alter table counselings add column acknowledged_at timestamptz;
alter table counselings add column signature_name text;

-- Row-level only (same trust model as suta_requests' resubmit policy): scoped
-- to the Soldier's own rows, but doesn't stop them editing a column this
-- policy wasn't meant for -- the app only ever sends the acknowledgment
-- fields from the Soldier-facing update path.
create policy "counselings_acknowledge_own" on counselings
  for update
  using (soldier_id in (select id from soldiers where profile_id = auth.uid()))
  with check (soldier_id in (select id from soldiers where profile_id = auth.uid()));
