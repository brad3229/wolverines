-- Lets a soldier see a phone directory for their own platoon (name + number,
-- nothing else -- not address, DOD ID, emergency contact, etc). A
-- security-definer function rather than a broader RLS policy on `soldiers`
-- itself, so the extra visibility is narrowly scoped to exactly these
-- columns and can't accidentally leak more just because the row is visible.
-- `same_squad` lets the UI list the caller's own squad first, then the rest
-- of the platoon. Returns nothing if the caller has no platoon assigned.
create or replace function platoonmates_directory()
returns table (
  id uuid,
  first_name text,
  last_name text,
  rank text,
  phone_number text,
  avatar_url text,
  same_squad boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id, s.first_name, s.last_name, s.rank, s.phone_number, s.avatar_url,
    coalesce(
      s.squad is not null
      and s.squad = (select my.squad from public.soldiers my where my.profile_id = auth.uid()),
      false
    ) as same_squad
  from public.soldiers s
  where s.status = 'active'
    and s.platoon is not null
    and s.platoon = (select my.platoon from public.soldiers my where my.profile_id = auth.uid())
  order by same_squad desc, s.last_name, s.first_name;
$$;

grant execute on function platoonmates_directory() to authenticated;
