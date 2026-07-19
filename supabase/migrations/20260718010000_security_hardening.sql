-- The calendar was readable by anyone with the (public, client-exposed) anon key,
-- no login required. Restrict it to authenticated users.
drop policy "drill_events_select_all" on drill_events;

create policy "drill_events_select_all" on drill_events
  for select using (auth.uid() is not null);

-- Require a verified second factor (TOTP) for admin actions -- but only for admins
-- who have actually enrolled one, so existing admins aren't locked out until they
-- opt in via the new Security page.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
  and (
    (select auth.jwt() ->> 'aal') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where auth.mfa_factors.user_id = auth.uid() and auth.mfa_factors.status = 'verified'
    )
  );
$$;
