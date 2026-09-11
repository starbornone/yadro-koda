-- public.profiles: one row per auth.users row.
--
-- Ownership model
--   * Rows are created by a trigger on auth.users insert and removed by ON DELETE CASCADE.
--   * email / phone / provider / providers / last_sign_in_at mirror auth.users and are kept in
--     sync by a trigger on auth.users update. Clients cannot write them.
--   * display_name is seeded from sign-up metadata, then owned by the profile. Clients may
--     update display_name and phone only, and only on their own row.
--
-- Written for a fresh project. If public.profiles already exists, diff this against
-- `supabase db pull` output rather than applying it as-is.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  phone text,
  provider text,
  providers text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

comment on table public.profiles is
  'Public profile per user. Auth-mirrored columns are maintained by triggers on auth.users.';

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Anonymous callers get nothing. Signed-in callers get their own row only. Inserts and deletes
-- are trigger/cascade-owned, so no client policies exist for them.
revoke all on table public.profiles from anon;
revoke insert, delete on table public.profiles from authenticated;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-level grant: even on their own row, clients can only touch the user-editable fields.
revoke update on table public.profiles from authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.auth_providers_array(app_metadata jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(p), '{}')
  from jsonb_array_elements_text(coalesce(app_metadata -> 'providers', '[]'::jsonb)) as p;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, display_name, email, phone, provider, providers, created_at, last_sign_in_at
  )
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    new.email,
    new.phone,
    new.raw_app_meta_data ->> 'provider',
    public.auth_providers_array(new.raw_app_meta_data),
    new.created_at,
    new.last_sign_in_at
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    email = new.email,
    phone = new.phone,
    provider = new.raw_app_meta_data ->> 'provider',
    providers = public.auth_providers_array(new.raw_app_meta_data),
    last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, phone, raw_app_meta_data, last_sign_in_at on auth.users
  for each row execute function public.handle_user_updated();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Backfill: users that existed before the trigger. No-op on a fresh project.
-- ---------------------------------------------------------------------------

insert into public.profiles (
  id, display_name, email, phone, provider, providers, created_at, last_sign_in_at
)
select
  u.id,
  nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
  u.email,
  u.phone,
  u.raw_app_meta_data ->> 'provider',
  public.auth_providers_array(u.raw_app_meta_data),
  u.created_at,
  u.last_sign_in_at
from auth.users as u
on conflict (id) do nothing;
