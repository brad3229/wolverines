-- Retracting a self-reported station (soldier changed their mind) upserts the row back to
-- status = 'incomplete'. Postgres checks an INSERT policy's WITH CHECK against the submitted
-- values even for INSERT ... ON CONFLICT DO UPDATE, regardless of whether the row already
-- exists and the statement actually resolves to an UPDATE -- so the old insert policy, which
-- only allowed status = 'self_reported', rejected every retraction with "new row violates
-- row-level security policy," even though the update policy would have allowed it.
drop policy "soldier_task_completions_insert_own" on soldier_task_completions;

create policy "soldier_task_completions_insert_own" on soldier_task_completions
  for insert with check (
    soldier_id in (select id from soldiers where profile_id = auth.uid())
    and status in ('incomplete', 'self_reported')
    and verified_by is null
    and verified_at is null
  );
