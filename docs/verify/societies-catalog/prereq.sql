create role anon nologin; create role authenticated nologin;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text, name text);
alter table storage.objects enable row level security;
create table public.spolky_accounts (association_id text, role text, user_id uuid, is_active boolean default true);
insert into public.spolky_accounts values
  ('esn','association',gen_random_uuid()),('supef','association',gen_random_uuid()),
  ('au_frrms','association',gen_random_uuid()),('usaf','association',gen_random_uuid()),
  ('ldf','association',gen_random_uuid()),('zf','association',gen_random_uuid()),
  ('ey','association',gen_random_uuid()),('reis','reis_admin',gen_random_uuid());
-- get_my_role() stub driven by a session setting, so each check can pick a role.
create function public.get_my_role() returns text language sql stable as
  $$ select nullif(current_setting('test.role', true), '') $$;
grant usage on schema public, storage to anon, authenticated;
grant execute on function public.get_my_role() to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
