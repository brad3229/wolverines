-- Lets a passkey sign-in satisfy the admin MFA requirement on its own,
-- without a separate TOTP step. A passkey is already phishing-resistant
-- (cryptographically bound to this domain, can't be replayed on a fake
-- login page the way a copied TOTP code can) and combines device
-- possession with a biometric/PIN in a single ceremony -- so it meets the
-- same security bar aal2 was added to enforce. Admins without a passkey
-- still need aal2 (TOTP) exactly as before.
--
-- auth.jwt()->>'amr' is a signed, server-issued record of every
-- authentication method used to establish the session (Supabase sets this,
-- not the client), so it can't be forged the same way the aal claim can't.
-- A passkey sign-in records {"method": "passkey", ...} in that array.
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
    or exists (
      select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) elem
      where elem ->> 'method' = 'passkey'
    )
  );
$$;
