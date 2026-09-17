-- Log every membership insert to the customer timeline as the person who joined, saying how
-- they came in; keep clients from writing that kind themselves. See schemas/30_crm.sql.

-- Someone joining is the moment a lead becomes a tenant, and worth a line on the timeline —
-- written as the person who joined. The RPCs say how they came in through the transaction-local
-- `app.joined_via` hint ('created' from create_organisation(), 'invitation' from
-- accept_invitation()). Linked to the contact staff held for them, when there is one:
-- memberships_link_contact runs first (triggers fire in name order).
create or replace function public.log_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activities (org_id, contact_id, kind, body, created_by)
  values (
    new.org_id,
    (
      select c.id from public.contacts c
      where c.org_id = new.org_id and c.user_id = new.user_id
      limit 1
    ),
    'joined',
    case current_setting('app.joined_via', true)
      when 'created' then 'Created the organisation'
      when 'invitation' then format('Accepted an invitation as %s', new.role)
      else format('Joined as %s', new.role)
    end,
    new.user_id
  );
  return new;
end;
$$;

create trigger memberships_log_join
  after insert on public.memberships
  for each row execute function public.log_join();

comment on table public.activities is
  'The customer timeline. Stage changes and joins are logged here by trigger.';

drop policy "activities_insert_staff" on public.activities;
create policy "activities_insert_staff"
  on public.activities
  for insert
  to authenticated
  with check (
    public.is_platform_member()
    and created_by = (select auth.uid())
    and kind not in ('stage_change', 'joined')
  );

drop policy "activities_update_author" on public.activities;
create policy "activities_update_author"
  on public.activities
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and kind not in ('stage_change', 'joined'));

-- The RPCs now say how someone joined.
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

  -- Read by log_join() (30_crm.sql) when the membership trigger fires below.
  perform set_config('app.joined_via', 'created', true);

  insert into public.memberships (org_id, user_id, role)
  values (org.id, caller, 'owner');

  update public.profiles set active_org_id = org.id where id = caller;

  return org;
end;
$$;

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

  -- Read by log_join() (30_crm.sql) when the membership trigger fires below.
  perform set_config('app.joined_via', 'invitation', true);

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
