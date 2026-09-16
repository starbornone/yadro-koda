-- Organisations (tenants) and memberships, plus the minimal platform-staff schema the tenant
-- policies need to reference. Two layers of access:
--
--   * Tenant layer — a user belongs to organisations through `memberships`, with an `org_role`.
--   * Platform layer — a user with a `platform_members` row is staff. Staff reach tenant rows
--     only through two named functions that every tenant policy calls, so a product can narrow
--     staff access (e.g. to assigned organisations) in one place:
--       platform_can_access_org()  — read:  every staff role
--       platform_can_manage_org()  — write: superadmin only
--     Adding staff is by invitation (25_invitations.sql); staff never self-sign-up.
--
-- One person may be both staff and an organisation member — the same auth.users row carries a
-- platform_members row and memberships. The app offers an account chooser between them.
--
-- Roles are deliberately generic; a product renames or extends the enums.
--   org_role:      owner > admin > member
--   platform_role: superadmin (full access to everything) > admin (manages staff below
--                  superadmin, reads tenants) > support (reads tenants)

create type public.org_role as enum ('owner', 'admin', 'member');
create type public.platform_role as enum ('superadmin', 'admin', 'support');

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

-- The read gate for staff reaching tenant data. Broad for now (any staff role can read any
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

-- The write gate: only the full-access tier may change tenant data on a tenant's behalf.
create or replace function public.platform_can_manage_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.platform_role() = 'superadmin';
$$;

-- Who may change or remove a staff row: superadmins anyone, admins anyone below superadmin.
create or replace function public.platform_can_manage_member(target_role public.platform_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.platform_role()
    when 'superadmin' then true
    when 'admin' then target_role <> 'superadmin'
    else false
  end;
$$;

-- Who may manage an organisation's members (invite, change roles, remove): its owners and
-- admins, and staff who may write on its behalf.
create or replace function public.can_manage_org_members(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(target_org, array['owner', 'admin']::public.org_role[])
    or public.platform_can_manage_org(target_org);
$$;

-- Who may change, remove or invite a member holding `target_role`: owners anyone, admins
-- anyone below owner. Checked against the old row (may I touch this person?) and the new one
-- (may I hand out this role?), so nobody promotes past their own tier.
create or replace function public.can_manage_org_member(target_org uuid, target_role public.org_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.platform_can_manage_org(target_org)
    or case public.org_role(target_org)
      when 'owner' then true
      when 'admin' then target_role <> 'owner'
      else false
    end;
$$;

-- True when the caller and `target_user` are both current members of at least one common
-- organisation. Lets colleagues see each other's profiles without exposing anyone else's.
create or replace function public.shares_org_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user
      and (mine.expires_at is null or mine.expires_at > now())
      and (theirs.expires_at is null or theirs.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_members enable row level security;

revoke all on table public.organisations, public.memberships, public.platform_members from anon;
-- Organisations are created through create_organisation() and create_lead() (30_crm.sql) and
-- never deleted from the client (yet). Memberships are created through create_organisation()
-- and accept_invitation() (25_invitations.sql); managers may change a role or remove a row.
revoke insert, delete on table public.organisations from authenticated;
revoke insert, update on table public.memberships from authenticated;
grant update (role) on table public.memberships to authenticated;
-- Staff are added through accept_platform_invitation() (25_invitations.sql); the tiers above
-- a row may change or remove it.
revoke insert on table public.platform_members from authenticated;
revoke update on table public.platform_members from authenticated;
grant update (role) on table public.platform_members to authenticated;

create policy "organisations_select_member_or_staff"
  on public.organisations
  for select
  to authenticated
  using (public.is_org_member(id) or public.platform_can_access_org(id));

create policy "organisations_update_owner_admin_or_superadmin"
  on public.organisations
  for update
  to authenticated
  using (
    public.has_org_role(id, array['owner', 'admin']::public.org_role[])
    or public.platform_can_manage_org(id)
  )
  with check (
    public.has_org_role(id, array['owner', 'admin']::public.org_role[])
    or public.platform_can_manage_org(id)
  );

-- Members can only change the organisation's name; the slug is fixed at creation for now.
revoke update on table public.organisations from authenticated;
grant update (name) on table public.organisations to authenticated;

create policy "memberships_select_same_org_or_staff"
  on public.memberships
  for select
  to authenticated
  using (public.is_org_member(org_id) or public.platform_can_access_org(org_id));

-- Owners manage anyone; admins anyone below owner; nobody hands out a role above their own.
-- The UI also stops people changing their own row; the last-owner trigger below is the only
-- rule the database adds on top.
create policy "memberships_update_manager_by_tier"
  on public.memberships
  for update
  to authenticated
  using (public.can_manage_org_member(org_id, role))
  with check (public.can_manage_org_member(org_id, role));

create policy "memberships_delete_manager_by_tier"
  on public.memberships
  for delete
  to authenticated
  using (public.can_manage_org_member(org_id, role));

-- Anyone may leave. (The last owner cannot: see protect_last_owner() below.)
create policy "memberships_delete_self"
  on public.memberships
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- An organisation with no owner cannot be administered. Refuse the change that would cause
-- it — unless the organisation itself is being deleted and its rows are cascading away.
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organisations o where o.id = old.org_id)
     and (
       select count(*) from public.memberships m
       where m.org_id = old.org_id
         and m.role = 'owner'
         and (m.expires_at is null or m.expires_at > now())
     ) <= 1 then
    raise exception 'cannot remove the last owner'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_protect_last_owner
  before update of role or delete on public.memberships
  for each row execute function public.protect_last_owner();

-- Someone who leaves (or is removed) should not still "be working in" that organisation:
-- clear the pointer so the app falls back to another of their organisations. Definer, since a
-- manager removing someone else may not touch that person's profile.
create or replace function public.forget_left_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set active_org_id = null
  where id = old.user_id and active_org_id = old.org_id;
  return old;
end;
$$;

create trigger memberships_forget_left_org
  after delete on public.memberships
  for each row execute function public.forget_left_org();

-- Every staff member can see the team; only the tiers above a row may change or remove it,
-- and nobody may promote past their own tier.
create policy "platform_members_select_staff"
  on public.platform_members
  for select
  to authenticated
  using (public.is_platform_member());

create policy "platform_members_update_by_tier"
  on public.platform_members
  for update
  to authenticated
  using (public.platform_can_manage_member(role))
  with check (public.platform_can_manage_member(role));

create policy "platform_members_delete_by_tier"
  on public.platform_members
  for delete
  to authenticated
  using (public.platform_can_manage_member(role));

-- A platform with no superadmin cannot be fully administered. Refuse the change that would
-- cause it.
create or replace function public.protect_last_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'superadmin'
     and (tg_op = 'DELETE' or new.role <> 'superadmin')
     and (select count(*) from public.platform_members where role = 'superadmin') <= 1 then
    raise exception 'cannot remove the last superadmin'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger platform_members_protect_last_superadmin
  before update of role or delete on public.platform_members
  for each row execute function public.protect_last_superadmin();

-- Colleagues can see each other's profiles; staff can see everyone's. Combined with
-- profiles_select_own (10_profiles.sql), since policies are OR-ed.
create policy "profiles_select_shared_org_or_staff"
  on public.profiles
  for select
  to authenticated
  using (public.shares_org_with(id) or public.is_platform_member());

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
-- create_organisation(): how a user makes their own organisation. Creates it, makes the caller
-- its owner and marks it active — atomically. (Staff enter organisations that have no users
-- yet through create_lead() in 30_crm.sql.)
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
