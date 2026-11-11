-- SPEC 12 — Registro, login y autenticación
-- One public profile per auth user, holding the unique username.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  -- Null only for OAuth accounts that have not picked a username yet.
  username    text unique check (username ~ '^[A-Z0-9_]{3,12}$'),
  created_at  timestamptz not null default now()
);

-- Creates the profile on sign-up. Email sign-ups pass the username in user
-- metadata; OAuth providers do not, so it stays null until /auth/alias.
-- A duplicate or malformed username makes the auth.users insert fail too,
-- which is what keeps usernames unique under concurrent sign-ups.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the trigger may run it; keep it off the /rest/v1/rpc surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Reads are public; inserts come only from the trigger, deletes only from the
-- cascade. A user may set their own username once, while it is still null.
alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "users set their own username once"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) and username is null)
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;
