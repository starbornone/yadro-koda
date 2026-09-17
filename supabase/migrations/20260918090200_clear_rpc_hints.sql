-- The RPCs pass hints to triggers through transaction-local settings. A setting outlives the
-- call that made it, so anything else inserted in the same transaction (a script, a test) was
-- being logged as "Created the organisation" or started as a lead. Clear each hint after use.

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

  -- Read by log_join() (30_crm.sql) when the membership trigger fires below. Cleared after:
  -- the setting lives for the transaction, which may outlast this call.
  perform set_config('app.joined_via', 'created', true);
  insert into public.memberships (org_id, user_id, role)
  values (org.id, caller, 'owner');
  perform set_config('app.joined_via', '', true);

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

  -- Read by log_join() (30_crm.sql) when the membership trigger fires below. Cleared after:
  -- the setting lives for the transaction, which may outlast this call.
  perform set_config('app.joined_via', 'invitation', true);
  insert into public.memberships (org_id, user_id, role, expires_at)
  values (invitation.org_id, caller, invitation.role, invitation.access_expires_at)
  on conflict (org_id, user_id) do update set expires_at = excluded.expires_at;
  perform set_config('app.joined_via', '', true);

  update public.invitations
  set accepted_at = now(), accepted_by = caller
  where id = invitation.id;

  update public.profiles set active_org_id = invitation.org_id where id = caller;

  select * into org from public.organisations o where o.id = invitation.org_id;
  return org;
end;
$$;

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

  -- Read by create_customer_for_organisation() when the trigger fires below. Cleared after:
  -- the setting lives for the transaction, which may outlast this call.
  perform set_config('app.customer_stage', 'lead', true);
  insert into public.organisations (name, slug, created_by)
  values (btrim(name), slug, caller)
  returning * into org;
  perform set_config('app.customer_stage', '', true);

  update public.customers
  set owner_id = caller, source = nullif(btrim(create_lead.source), '')
  where org_id = org.id;

  return org;
end;
$$;
