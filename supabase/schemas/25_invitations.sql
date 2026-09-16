-- Invitations: how people join an organisation that already exists. Someone who may manage
-- the organisation's members (an owner or admin, or staff who may write on its behalf) creates
-- one for an email address and a role; the app turns it into a link that the inviter passes
-- on. Whoever signs in with that email and opens the link becomes a member. After
-- create_organisation(), accept_invitation() is the only way a membership row is created.
--
-- The token in the link is the secret, but not the whole key: an invitation is bound to its
-- email, so the link only works for a session whose profile carries that address. That is why
-- every staff tier may read invitations (they are part of the customer record) even though only
-- managers may create or revoke them. The invitee, who may not be signed in yet, reads the
-- invitation through get_invitation(token), which returns only what the accept screen shows.
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
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invitations is
  'Pending and accepted invitations to join an organisation. The token is the link secret.';
comment on column public.invitations.email is
  'Stored lower-cased; accept_invitation() only lets a session with this email accept.';

create index invitations_org_id_idx on public.invitations (org_id);
-- One open invitation per address per organisation. Revoke (delete) it to send a fresh one.
create unique index invitations_one_pending_per_email
  on public.invitations (org_id, email) where accepted_at is null;

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.invitations enable row level security;

revoke all on table public.invitations from anon;
-- Clients create and delete invitations; accepting is accept_invitation()'s job.
revoke insert, update on table public.invitations from authenticated;
grant insert (org_id, email, role) on table public.invitations to authenticated;

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

-- ---------------------------------------------------------------------------
-- get_invitation(): what the accept screen shows, to anyone holding the link — including a
-- visitor who has not signed in yet, so they know which account to sign in with. Nothing
-- beyond the invitation's own facts is revealed.
-- ---------------------------------------------------------------------------

create or replace function public.get_invitation(token uuid)
returns table (
  organisation_name text,
  email text,
  role public.org_role,
  invited_by_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    i.email,
    i.role,
    nullif(btrim(p.display_name), ''),
    i.expires_at,
    i.accepted_at
  from public.invitations i
  join public.organisations o on o.id = i.org_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = get_invitation.token;
$$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation(): the caller joins the organisation with the invited role, the
-- invitation is marked used, and the organisation becomes their active one — atomically. The
-- caller's profile email must match the invitation's. Someone who already belongs keeps their
-- current role; if their access had expired it is restored.
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

  insert into public.memberships (org_id, user_id, role)
  values (invitation.org_id, caller, invitation.role)
  on conflict (org_id, user_id) do update set expires_at = null;

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
