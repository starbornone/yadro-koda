-- Organisations (tenants) and memberships, plus the minimal platform-staff schema the tenant
-- policies need to reference. Two layers of access:
--
--   * Tenant layer — a user belongs to organisations through `memberships`, with an `org_role`.
--   * Platform layer — a user with a `platform_members` row is staff. Staff reach tenant rows
--     only through `platform_can_access_org()`, one named function that every tenant policy
--     calls, so a product can later narrow staff access (e.g. to assigned organisations) in one
--     place. The platform UI and write policies are defined with the staff layer.
--
-- Roles are deliberately generic; a product renames or extends the enums.

create type public.org_role as enum ('owner', 'admin', 'member');
create type public.platform_role as enum ('admin', 'support');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 50),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organisations is 'Tenants. Members join through public.memberships.';

create table public.memberships (
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  -- Time-boxed access (e.g. an external reviewer). NULL means no expiry.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

comment on column public.memberships.expires_at is
  'Membership stops granting access after this instant. NULL = never expires.';

create table public.platform_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.platform_role not null default 'support',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_members is 'Staff of the platform itself, not of any tenant.';

-- profiles.active_org_id is declared in 10_profiles.sql; the organisations table has to exist
-- before it can be a foreign key.
alter table public.profiles
  add constraint profiles_active_org_id_fkey
  foreign key (active_org_id) references public.organisations (id) on delete set null;

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function public.set_updated_at();

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

create trigger platform_members_set_updated_at
  before update on public.platform_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (stable, security definer so they can read the membership tables from
-- inside policies on those same tables without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.user_id = (select auth.uid())
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

create or replace function public.org_role(target_org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.org_id = target_org
    and m.user_id = (select auth.uid())
    and (m.expires_at is null or m.expires_at > now());
$$;

create or replace function public.has_org_role(target_org uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.org_role(target_org) = any (roles);
$$;

create or replace function public.platform_role()
returns public.platform_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.platform_members p
  where p.user_id = (select auth.uid());
$$;

create or replace function public.is_platform_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.platform_role() is not null;
$$;

-- The single gate for staff reaching tenant data. Broad for now (any staff role can read any
-- organisation); narrow it here when the product needs assignment-based access.
create or replace function public.platform_can_access_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_member();
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_members enable row level security;

revoke all on table public.organisations, public.memberships, public.platform_members from anon;
-- Rows are created through create_organisation(); direct inserts/deletes come with the
-- invitation and member-management work.
revoke insert, delete on table public.organisations, public.memberships from authenticated;
revoke insert, update, delete on table public.platform_members from authenticated;

create policy "organisations_select_member_or_staff"
  on public.organisations
  for select
  to authenticated
  using (public.is_org_member(id) or public.platform_can_access_org(id));

create policy "organisations_update_owner_admin"
  on public.organisations
  for update
  to authenticated
  using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));

-- Members can only change the organisation's name; the slug is fixed at creation for now.
revoke update on table public.organisations from authenticated;
grant update (name) on table public.organisations to authenticated;

create policy "memberships_select_same_org_or_staff"
  on public.memberships
  for select
  to authenticated
  using (public.is_org_member(org_id) or public.platform_can_access_org(org_id));

create policy "platform_members_select_self_or_admin"
  on public.platform_members
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.platform_role() = 'admin');

-- profiles.active_org_id is user-editable (granted in 10_profiles.sql) but must point at one of
-- the user's organisations.
create or replace function public.validate_active_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active_org_id is not null
     and not exists (
       select 1 from public.memberships m
       where m.org_id = new.active_org_id and m.user_id = new.id
     ) then
    raise exception 'active_org_id must reference an organisation the user belongs to'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_active_org
  before update of active_org_id on public.profiles
  for each row execute function public.validate_active_org();

-- ---------------------------------------------------------------------------
-- create_organisation(): the only way to make an organisation. Creates it, makes the caller
-- its owner and marks it active — atomically, so there is never an orphaned organisation.
-- ---------------------------------------------------------------------------

create or replace function public.create_organisation(name text, slug text)
returns public.organisations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  org public.organisations;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  insert into public.organisations (name, slug, created_by)
  values (btrim(name), slug, caller)
  returning * into org;

  insert into public.memberships (org_id, user_id, role)
  values (org.id, caller, 'owner');

  update public.profiles set active_org_id = org.id where id = caller;

  return org;
end;
$$;

revoke all on function public.create_organisation(text, text) from public;
grant execute on function public.create_organisation(text, text) to authenticated;
