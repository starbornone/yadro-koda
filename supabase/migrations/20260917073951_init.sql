-- ---- 00_helpers.sql ----

-- Shared helpers. Applied first; later files depend on them.

-- Keeps `updated_at` honest on any table that attaches this as a BEFORE UPDATE trigger.
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

-- ---- 10_profiles.sql ----

-- public.profiles: one row per auth.users row.
--
-- Ownership model
--   * Rows are created by a trigger on auth.users insert and removed by ON DELETE CASCADE.
--   * email / phone / provider / providers / last_sign_in_at mirror auth.users and are kept in
--     sync by a trigger on auth.users update. Clients cannot write them.
--   * display_name is seeded from sign-up metadata, then owned by the profile.
--   * active_org_id remembers the organisation the user last worked in. Its foreign key and
--     validation live in 20_organisations.sql, which defines the organisations table.
--   * Clients may update display_name, phone and active_org_id only, and only on their own row.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  phone text,
  provider text,
  providers text[],
  active_org_id uuid,
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
grant update (display_name, phone, active_org_id) on table public.profiles to authenticated;

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

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---- 20_organisations.sql ----

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
-- Organisations are created through create_organisation() and create_lead() (30_crm.sql);
-- owners delete them (policy below). Memberships are created through create_organisation()
-- and accept_invitation() (25_invitations.sql); managers may change a role or remove a row.
revoke insert on table public.organisations from authenticated;
revoke insert, update on table public.memberships from authenticated;
grant update (role, expires_at) on table public.memberships to authenticated;
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

-- Deleting takes everything with it — memberships, invitations, the CRM record — so only an
-- owner may (or a superadmin on the tenant's behalf). protect_last_owner() stands aside for
-- the cascade.
create policy "organisations_delete_owner_or_superadmin"
  on public.organisations
  for delete
  to authenticated
  using (
    public.has_org_role(id, array['owner']::public.org_role[])
    or public.platform_can_manage_org(id)
  );

create policy "memberships_select_same_org_or_staff"
  on public.memberships
  for select
  to authenticated
  using (public.is_org_member(org_id) or public.platform_can_access_org(org_id));

-- Owners manage anyone; admins anyone below owner; nobody hands out a role above their own.
-- The same people set or clear a member's `expires_at` (time-boxed access). The UI also stops
-- people changing their own row; the last-owner trigger below is the only rule the database
-- adds on top.
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
-- it — removing, demoting or expiring the only owner whose access is current — unless the
-- organisation itself is being deleted and its rows are cascading away. (An expiry set in the
-- future is allowed; the clock will then do what this trigger cannot.)
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (old.expires_at is null or old.expires_at > now())
     and (
       tg_op = 'DELETE'
       or new.role <> 'owner'
       or (new.expires_at is not null and new.expires_at <= now())
     )
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
  before update of role, expires_at or delete on public.memberships
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

-- ---- 25_invitations.sql ----

-- Invitations: how people join something that already exists — an organisation, or the staff
-- team. Someone who may manage its members creates one for an email address and a role; the
-- app turns it into a link that the inviter passes on. Whoever signs in with that email and
-- opens the link joins. After create_organisation(), accept_invitation() is the only way a
-- membership row is created, and accept_platform_invitation() is the only way a
-- platform_members row is.
--
--   invitations           to an organisation, from its owners/admins (or a superadmin on its
--                         behalf); the invited role is an org_role
--   platform_invitations  to the staff team, from admins and up; the invited role is a
--                         platform_role
--
-- The token in the link is the secret, but not the whole key: an invitation is bound to its
-- email, so the link only works for a session whose profile carries that address. That is why
-- every staff tier may read both tables (organisation invitations are part of the customer
-- record; team invitations are part of the team) even though only managers may create or
-- revoke them. The invitee, who may not be signed in yet, reads their invitation through
-- get_invitation(token), which returns only what the accept screen shows.
--
-- Accepted rows are kept as the record of who joined how; revoking one deletes it.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  email text not null
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$' and char_length(email) <= 254),
  role public.org_role not null default 'member',
  -- The secret in the link. A random uuid is 122 bits: not guessable.
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  -- When the link stops working.
  expires_at timestamptz not null default now() + interval '7 days',
  -- When the membership it creates stops working (memberships.expires_at). NULL = never.
  access_expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invitations is
  'Pending and accepted invitations to join an organisation. The token is the link secret.';
comment on column public.invitations.email is
  'Stored lower-cased; accept_invitation() only lets a session with this email accept.';
comment on column public.invitations.access_expires_at is
  'Copied to memberships.expires_at on accept: time-boxed access. NULL = no expiry.';

create index invitations_org_id_idx on public.invitations (org_id);
-- One open invitation per address per organisation. Revoke (delete) it to send a fresh one.
create unique index invitations_one_pending_per_email
  on public.invitations (org_id, email) where accepted_at is null;

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

create table public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$' and char_length(email) <= 254),
  role public.platform_role not null default 'support',
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_invitations is
  'Pending and accepted invitations to join the staff team. The token is the link secret.';

-- One open invitation per address. Revoke (delete) it to send a fresh one.
create unique index platform_invitations_one_pending_per_email
  on public.platform_invitations (email) where accepted_at is null;

create trigger platform_invitations_set_updated_at
  before update on public.platform_invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.invitations enable row level security;
alter table public.platform_invitations enable row level security;

revoke all on table public.invitations, public.platform_invitations from anon;
-- Clients create and delete invitations; accepting is the RPCs' job.
revoke insert, update on table public.invitations, public.platform_invitations from authenticated;
grant insert (org_id, email, role, access_expires_at) on table public.invitations to authenticated;
grant insert (email, role) on table public.platform_invitations to authenticated;

create policy "invitations_select_manager_or_staff"
  on public.invitations
  for select
  to authenticated
  using (public.can_manage_org_members(org_id) or public.platform_can_access_org(org_id));

-- Inviting someone as `role` is managing a member with that role: the same tier rule as
-- changing one, so an admin cannot invite an owner.
create policy "invitations_insert_manager_by_tier"
  on public.invitations
  for insert
  to authenticated
  with check (
    public.can_manage_org_member(org_id, role)
    and invited_by = (select auth.uid())
  );

create policy "invitations_delete_manager_by_tier"
  on public.invitations
  for delete
  to authenticated
  using (public.can_manage_org_member(org_id, role));

-- The team's invitations follow the team's tier rule (platform_can_manage_member): superadmins
-- invite anyone, admins anyone below superadmin, support nobody.
create policy "platform_invitations_select_staff"
  on public.platform_invitations
  for select
  to authenticated
  using (public.is_platform_member());

create policy "platform_invitations_insert_by_tier"
  on public.platform_invitations
  for insert
  to authenticated
  with check (
    public.platform_can_manage_member(role)
    and invited_by = (select auth.uid())
  );

create policy "platform_invitations_delete_by_tier"
  on public.platform_invitations
  for delete
  to authenticated
  using (public.platform_can_manage_member(role));

-- ---------------------------------------------------------------------------
-- get_invitation(): what the accept screen shows, to anyone holding the link — including a
-- visitor who has not signed in yet, so they know which account to sign in with. Looks in
-- both tables (tokens are random uuids, so a link is one or the other), and says which with
-- `kind`. Nothing beyond the invitation's own facts is revealed.
-- ---------------------------------------------------------------------------

create or replace function public.get_invitation(token uuid)
returns table (
  kind text,
  organisation_name text,
  email text,
  role text,
  invited_by_name text,
  expires_at timestamptz,
  access_expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'organisation',
    o.name,
    i.email,
    i.role::text,
    nullif(btrim(p.display_name), ''),
    i.expires_at,
    i.access_expires_at,
    i.accepted_at
  from public.invitations i
  join public.organisations o on o.id = i.org_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = get_invitation.token
  union all
  select
    'platform',
    null,
    i.email,
    i.role::text,
    nullif(btrim(p.display_name), ''),
    i.expires_at,
    null,
    i.accepted_at
  from public.platform_invitations i
  left join public.profiles p on p.id = i.invited_by
  where i.token = get_invitation.token;
$$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation(): the caller joins the organisation with the invited role and access
-- end, the invitation is marked used, and the organisation becomes their active one —
-- atomically. The caller's profile email must match the invitation's. Someone who already
-- belongs keeps their current role and takes the invitation's access end (which restores
-- access that had expired).
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(token uuid)
returns public.organisations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
  invitation public.invitations;
  org public.organisations;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into invitation
  from public.invitations i
  where i.token = accept_invitation.token
  for update;

  if invitation.id is null then
    raise exception 'invitation not found' using errcode = 'no_data_found';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'invitation has already been used' using errcode = 'check_violation';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = 'check_violation';
  end if;

  select lower(p.email) into caller_email from public.profiles p where p.id = caller;
  if caller_email is distinct from invitation.email then
    raise exception 'invitation was sent to a different email address'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.memberships (org_id, user_id, role, expires_at)
  values (invitation.org_id, caller, invitation.role, invitation.access_expires_at)
  on conflict (org_id, user_id) do update set expires_at = excluded.expires_at;

  update public.invitations
  set accepted_at = now(), accepted_by = caller
  where id = invitation.id;

  update public.profiles set active_org_id = invitation.org_id where id = caller;

  select * into org from public.organisations o where o.id = invitation.org_id;
  return org;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_platform_invitation(): the caller joins the staff team with the invited role and the
-- invitation is marked used — atomically, with the same checks as above. Someone already on
-- the team keeps their current role.
-- ---------------------------------------------------------------------------

create or replace function public.accept_platform_invitation(token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
  invitation public.platform_invitations;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into invitation
  from public.platform_invitations i
  where i.token = accept_platform_invitation.token
  for update;

  if invitation.id is null then
    raise exception 'invitation not found' using errcode = 'no_data_found';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'invitation has already been used' using errcode = 'check_violation';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = 'check_violation';
  end if;

  select lower(p.email) into caller_email from public.profiles p where p.id = caller;
  if caller_email is distinct from invitation.email then
    raise exception 'invitation was sent to a different email address'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.platform_members (user_id, role)
  values (caller, invitation.role)
  on conflict (user_id) do nothing;

  update public.platform_invitations
  set accepted_at = now(), accepted_by = caller
  where id = invitation.id;
end;
$$;

revoke all on function public.accept_platform_invitation(uuid) from public;
grant execute on function public.accept_platform_invitation(uuid) to authenticated;

-- ---- 30_crm.sql ----

-- CRM: the staff-side view of every organisation across its lifecycle, from lead to churn.
--
-- An organisation is the customer record. It exists from the moment staff enter it as a lead —
-- with no members yet — and the same row becomes the tenant when its first user joins, so
-- nothing is copied between a "lead" and a "customer". Everything staff know about it lives
-- in tables tenants never see:
--
--   customers   one row per organisation (created by trigger): stage, owner (account manager),
--               source. Every stage change is logged to the timeline automatically.
--   contacts    people at the customer — not necessarily users. `user_id` links a contact to
--               the account they sign in with once they have one.
--   activities  the timeline: notes, calls, emails, meetings, stage changes.
--   tasks       follow-ups for staff, assigned to a staff member, with a due date.
--
-- Access: every staff tier reads all of it and logs activity (contacts, notes, tasks). Moving
-- the pipeline — stage, owner, source, and creating organisations as leads — needs
-- platform_can_manage_customers() (superadmin, admin). Tenants have no access at all.
--
-- The stage names are a generic funnel; a product renames them.

create type public.customer_stage as enum (
  'lead', 'qualified', 'trial', 'active', 'churned', 'lost'
);
create type public.activity_kind as enum ('note', 'call', 'email', 'meeting', 'stage_change');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.customers (
  org_id uuid primary key references public.organisations (id) on delete cascade,
  -- Set by create_customer_for_organisation(); see the hint there.
  stage public.customer_stage not null,
  -- The staff member responsible for this customer. Cleared if they leave the team.
  owner_id uuid references public.platform_members (user_id) on delete set null,
  -- Where the lead came from (free text: "website", "referral from Acme", …).
  source text check (source is null or char_length(source) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'Staff-only lifecycle record for each organisation. One row per organisation, by trigger.';

create index customers_stage_idx on public.customers (stage);
create index customers_owner_id_idx on public.customers (owner_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text check (email is null or (email ~ '^[^@[:space:]]+@[^@[:space:]]+$' and char_length(email) <= 254)),
  phone text check (phone is null or char_length(phone) between 1 and 30),
  -- Job title.
  title text check (title is null or char_length(title) between 1 and 100),
  is_primary boolean not null default false,
  -- Set once the contact has a sign-in of their own (e.g. accepted an invitation).
  user_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is 'People at a customer organisation, whether or not they are users.';

create index contacts_org_id_idx on public.contacts (org_id);
-- At most one primary contact per organisation; set_primary_contact() keeps it that way.
create unique index contacts_one_primary_per_org on public.contacts (org_id) where is_primary;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  kind public.activity_kind not null default 'note',
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.activities is 'The customer timeline. Stage changes are logged here by trigger.';

create index activities_org_id_occurred_at_idx on public.activities (org_id, occurred_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_on date,
  assigned_to uuid references public.platform_members (user_id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is 'Follow-ups for staff about a customer.';

create index tasks_org_id_idx on public.tasks (org_id);
create index tasks_open_by_assignee_idx on public.tasks (assigned_to, due_on) where completed_at is null;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------

-- Who moves the pipeline: superadmins and admins. Support logs activity but does not change
-- stage or ownership.
create or replace function public.platform_can_manage_customers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.platform_role() in ('superadmin', 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Triggers that keep the record consistent
-- ---------------------------------------------------------------------------

-- Every organisation gets its customers row the moment it exists, whoever created it. An
-- organisation that appears on its own (self-serve sign-up via create_organisation()) starts as
-- a trial; create_lead() sets the transaction-local `app.customer_stage` hint so staff-entered
-- organisations start as leads. Definer so it works from inside either RPC.
create or replace function public.create_customer_for_organisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customers (org_id, stage)
  values (
    new.id,
    coalesce(nullif(current_setting('app.customer_stage', true), ''), 'trial')::public.customer_stage
  );
  return new;
end;
$$;

create trigger organisations_create_customer
  after insert on public.organisations
  for each row execute function public.create_customer_for_organisation();

-- A stage change is worth remembering: log it to the timeline as the person who made it.
create or replace function public.log_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activities (org_id, kind, body)
  values (new.org_id, 'stage_change', format('Stage changed from %s to %s', old.stage, new.stage));
  return new;
end;
$$;

create trigger customers_log_stage_change
  after update of stage on public.customers
  for each row
  when (old.stage is distinct from new.stage)
  execute function public.log_stage_change();

-- Making a contact primary demotes the organisation's previous primary contact.
create or replace function public.set_primary_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_primary then
    update public.contacts
    set is_primary = false
    where org_id = new.org_id and id <> new.id and is_primary;
  end if;
  return new;
end;
$$;

create trigger contacts_set_primary
  before insert or update of is_primary on public.contacts
  for each row execute function public.set_primary_contact();

-- When someone joins an organisation, the contact staff already hold for them (same email,
-- not yet linked) becomes theirs. This is how a lead's contact and the account they sign in
-- with end up as one person; there is no way to link them by hand.
create or replace function public.link_contact_to_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contacts c
  set user_id = new.user_id
  from public.profiles p
  where p.id = new.user_id
    and c.org_id = new.org_id
    and c.user_id is null
    and c.email is not null
    and lower(c.email) = lower(p.email);
  return new;
end;
$$;

create trigger memberships_link_contact
  after insert on public.memberships
  for each row execute function public.link_contact_to_member();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.contacts enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;

revoke all on table public.customers, public.contacts, public.activities, public.tasks from anon;

-- customers: rows come and go with their organisation (trigger + cascade), never directly.
revoke insert, delete on table public.customers from authenticated;
revoke update on table public.customers from authenticated;
grant update (stage, owner_id, source) on table public.customers to authenticated;

create policy "customers_select_staff"
  on public.customers
  for select
  to authenticated
  using (public.is_platform_member());

create policy "customers_update_manager"
  on public.customers
  for update
  to authenticated
  using (public.platform_can_manage_customers())
  with check (public.platform_can_manage_customers());

-- contacts: any staff member adds or edits; removal needs a manager or the person who added
-- them. `user_id` is linked server-side (invitations) rather than by hand.
revoke insert, update on table public.contacts from authenticated;
grant insert (org_id, name, email, phone, title, is_primary) on table public.contacts to authenticated;
grant update (name, email, phone, title, is_primary) on table public.contacts to authenticated;

create policy "contacts_select_staff"
  on public.contacts
  for select
  to authenticated
  using (public.is_platform_member());

create policy "contacts_insert_staff"
  on public.contacts
  for insert
  to authenticated
  with check (public.is_platform_member() and created_by = (select auth.uid()));

create policy "contacts_update_staff"
  on public.contacts
  for update
  to authenticated
  using (public.is_platform_member())
  with check (public.is_platform_member());

create policy "contacts_delete_creator_or_manager"
  on public.contacts
  for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.platform_can_manage_customers());

-- activities: anyone on staff logs; only the author edits; author or manager removes.
-- Stage changes are written by trigger only.
revoke insert, update on table public.activities from authenticated;
grant insert (org_id, contact_id, kind, body, occurred_at) on table public.activities to authenticated;
grant update (contact_id, kind, body, occurred_at) on table public.activities to authenticated;

create policy "activities_select_staff"
  on public.activities
  for select
  to authenticated
  using (public.is_platform_member());

create policy "activities_insert_staff"
  on public.activities
  for insert
  to authenticated
  with check (
    public.is_platform_member()
    and created_by = (select auth.uid())
    and kind <> 'stage_change'
  );

create policy "activities_update_author"
  on public.activities
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and kind <> 'stage_change');

create policy "activities_delete_author_or_manager"
  on public.activities
  for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.platform_can_manage_customers());

-- tasks: anyone on staff creates, completes or reassigns; creator or manager removes.
revoke insert, update on table public.tasks from authenticated;
grant insert (org_id, title, due_on, assigned_to) on table public.tasks to authenticated;
grant update (title, due_on, assigned_to, completed_at) on table public.tasks to authenticated;

create policy "tasks_select_staff"
  on public.tasks
  for select
  to authenticated
  using (public.is_platform_member());

create policy "tasks_insert_staff"
  on public.tasks
  for insert
  to authenticated
  with check (public.is_platform_member() and created_by = (select auth.uid()));

create policy "tasks_update_staff"
  on public.tasks
  for update
  to authenticated
  using (public.is_platform_member())
  with check (public.is_platform_member());

create policy "tasks_delete_creator_or_manager"
  on public.tasks
  for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.platform_can_manage_customers());

-- ---------------------------------------------------------------------------
-- Pipeline counts, for the staff overview. Runs as the caller, so RLS applies.
-- ---------------------------------------------------------------------------

create view public.customer_stage_counts
with (security_invoker = true)
as
  select stage, count(*)::int as count
  from public.customers
  group by stage;

revoke all on table public.customer_stage_counts from anon;

-- ---------------------------------------------------------------------------
-- create_lead(): staff enter an organisation before it has any users. It starts at `lead`,
-- owned by whoever entered it. Its first user arrives by invitation (25_invitations.sql).
-- ---------------------------------------------------------------------------

create or replace function public.create_lead(name text, slug text, source text default null)
returns public.organisations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  org public.organisations;
begin
  if not public.platform_can_manage_customers() then
    raise exception 'only platform admins can create leads' using errcode = 'insufficient_privilege';
  end if;

  -- Read by create_customer_for_organisation() when the trigger fires below.
  perform set_config('app.customer_stage', 'lead', true);

  insert into public.organisations (name, slug, created_by)
  values (btrim(name), slug, caller)
  returning * into org;

  update public.customers
  set owner_id = caller, source = nullif(btrim(create_lead.source), '')
  where org_id = org.id;

  return org;
end;
$$;

revoke all on function public.create_lead(text, text, text) from public;
grant execute on function public.create_lead(text, text, text) to authenticated;

