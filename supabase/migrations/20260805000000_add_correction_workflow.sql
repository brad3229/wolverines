-- Lets admin send a Gear/SUTA request back to the Soldier for corrections
-- (e.g. after previewing the generated PDF and spotting something wrong)
-- instead of only Approve/Deny or Resolve.
--
-- Deliberately doesn't add a new enum value for this -- Postgres won't allow
-- a newly-added enum value to be used (e.g. in a policy's WHERE clause) in
-- the same transaction that added it, which broke the first attempt at this
-- migration. Presence of correction_notes is the "needs correction" signal
-- instead; status stays within its existing open/pending values.

alter table gear_requests add column correction_notes text;
alter table suta_requests add column correction_notes text;

-- Lets a Soldier edit and resubmit their own request, but only while cadre
-- has actually sent it back (correction_notes is set), and only to clear
-- that note -- not to touch anything else the "own" insert policy doesn't
-- already allow them to set.
create policy "gear_requests_resubmit_own" on gear_requests
  for update
  using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and correction_notes is not null
  )
  with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and correction_notes is null
    and status = 'open'
  );

create policy "suta_requests_resubmit_own" on suta_requests
  for update
  using (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and correction_notes is not null
  )
  with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and correction_notes is null
    and status = 'pending'
  );
