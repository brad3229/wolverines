-- Profile picture upload. Soldiers have no general self-UPDATE policy on
-- their own row (see soldiers_select_own) -- rather than opening one up
-- (even narrowly, Postgres RLS can't restrict UPDATE to a single column),
-- a security definer function lets a Soldier change only their own
-- avatar_url, nothing else, without touching that policy at all.
alter table soldiers
  add column avatar_url text;

create or replace function set_own_avatar_url(new_url text)
returns void
language sql
security definer
set search_path = public
as $$
  update soldiers set avatar_url = new_url, updated_at = now() where profile_id = auth.uid();
$$;

grant execute on function set_own_avatar_url(text) to authenticated;

-- Storage bucket for avatar images. Public read (the app itself is already
-- behind login; avatar photos aren't sensitive enough to need signed URLs),
-- writes restricted to the object's own folder matching the uploader's
-- auth uid, so a Soldier can only manage their own file.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_admin_all" on storage.objects
  for all using (bucket_id = 'avatars' and is_admin()) with check (bucket_id = 'avatars' and is_admin());
