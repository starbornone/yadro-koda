-- What the product records about a customer beyond the pipeline, as an object of
-- product-defined fields (src/config/customer-fields.ts): a column, the grant to edit it, and
-- create_lead() taking it so a lead can be entered with its details in one go. The old
-- three-argument create_lead() goes: two overloads would be ambiguous through PostgREST.

alter table public.customers
  add column details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384);

grant update (details) on table public.customers to authenticated;

drop function public.create_lead(text, text, text);

create or replace function public.create_lead(
  name text,
  slug text,
  source text default null,
  details jsonb default '{}'::jsonb
)
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
  set
    owner_id = caller,
    source = nullif(btrim(create_lead.source), ''),
    details = coalesce(create_lead.details, '{}'::jsonb)
  where org_id = org.id;

  return org;
end;
$$;

revoke all on function public.create_lead(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_lead(text, text, text, jsonb) to authenticated;
