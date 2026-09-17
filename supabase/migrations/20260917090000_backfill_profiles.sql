-- Profiles for users created before the on_auth_user_created trigger existed. See
-- schemas/10_profiles.sql; this is the same function, applied to the live database.

create or replace function public.backfill_profiles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
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
  from auth.users u
  on conflict (id) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.backfill_profiles() from public, anon, authenticated;

select public.backfill_profiles();
