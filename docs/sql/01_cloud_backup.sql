-- MumAAC cloud backup. Run once in the Supabase SQL editor of the MumAAC
-- project, AFTER creating the family login under Authentication -> Users.
-- Safe to run again.

-- Who may read and write her data. Only people listed here; signing up alone
-- grants nothing.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Every scribble she has written. word is null until someone labels it.
create table if not exists public.samples (
  id uuid primary key,
  word text,
  strokes jsonb not null,
  written_at timestamptz not null,
  device text,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists samples_updated_at on public.samples (updated_at);

-- Settings and what the keyboard has learned, as one document.
create table if not exists public.profile (
  id text primary key,
  data jsonb not null,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now()
);

-- Devices ask for "everything changed since X", so the server stamps each change.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists samples_touch on public.samples;
create trigger samples_touch before insert or update on public.samples
  for each row execute function public.touch_updated_at();
drop trigger if exists profile_touch on public.profile;
create trigger profile_touch before insert or update on public.profile
  for each row execute function public.touch_updated_at();

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;

alter table public.members enable row level security; -- no policies: nobody reads it through the API
alter table public.samples enable row level security;
alter table public.profile enable row level security;

drop policy if exists samples_members on public.samples;
create policy samples_members on public.samples for all to authenticated
  using (public.is_member()) with check (public.is_member());
drop policy if exists profile_members on public.profile;
create policy profile_members on public.profile for all to authenticated
  using (public.is_member()) with check (public.is_member());

revoke all on public.members, public.samples, public.profile from anon, authenticated;
grant select, insert, update on public.samples, public.profile to authenticated;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- Everyone who has a login right now becomes a member. Run this line again
-- after adding another family login.
insert into public.members (user_id) select id from auth.users on conflict do nothing;

select count(*) as family_logins_with_access from public.members;
