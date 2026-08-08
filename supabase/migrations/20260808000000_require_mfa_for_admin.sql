-- Makes MFA mandatory for the admin role instead of opt-in. Previously
-- is_admin() only demanded aal2 if the account already had a verified TOTP
-- factor -- meaning an admin who'd never enrolled got full access on just a
-- password. Now aal2 is required unconditionally for admin access; a fresh
-- admin account is locked out of every admin-gated table until they enroll
-- (the app forces them through setup before anything else renders -- see
-- useAuth's needsMfaEnrollment / MfaEnrollmentRequired).
--
-- Recovery note: if an admin loses their authenticator and no other admin is
-- available to reset it via the app (Security page -> Other Admins), the
-- project owner can clear it directly:
--   delete from auth.mfa_factors where user_id = '<uuid>';
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
  and (select auth.jwt() ->> 'aal') = 'aal2';
$$;
