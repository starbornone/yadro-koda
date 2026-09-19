-- The anonymous door: submit_enquiry() and its rate-limit table, and enquiries as a kind the
-- database writes and clients cannot. See schemas/30_crm.sql.

comment on table public.activities is
  'The customer timeline. Stage changes, joins and website enquiries are logged here by the database.';

drop policy "activities_insert_staff" on public.activities;
create policy "activities_insert_staff"
  on public.activities
  for insert
  to authenticated
  with check (
    public.is_platform_member()
    and created_by = (select auth.uid())
    and kind not in ('stage_change', 'joined', 'enquiry')
  );

drop policy "activities_update_author" on public.activities;
create policy "activities_update_author"
  on public.activities
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid()) and kind not in ('stage_change', 'joined', 'enquiry')
  );

-- ---------------------------------------------------------------------------
-- submit_enquiry(): the anonymous door. The website's "get started" form calls it with who
-- they are and the product's fields; the organisation enters the pipeline as a lead sourced
-- from the website, with the person as its primary contact and the enquiry on the timeline.
-- Nothing comes back: the prospect learns nothing about what exists.
--
-- Two guards, both silent to a bot: a honeypot argument that a person never fills in, and
-- one enquiry per email address a day (a double-click makes one lead, not two). A third is
-- loud: twenty enquiries an hour from one address (the IP the gateway reports) is too many
-- for people, and few enough for a flood.
-- ---------------------------------------------------------------------------

-- What has been tried, by whom, for the guards above. Never readable by clients.
create table public.enquiry_attempts (
  id uuid primary key default gen_random_uuid(),
  -- A hash of the caller's IP address: enough to count by, not worth keeping.
  ip_hash text not null,
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.enquiry_attempts is
  'Website enquiries by IP hash and email, for rate limiting. Private.';

create index enquiry_attempts_ip_hash_created_at_idx
  on public.enquiry_attempts (ip_hash, created_at);
create index enquiry_attempts_email_created_at_idx
  on public.enquiry_attempts (email, created_at);

alter table public.enquiry_attempts enable row level security;
revoke all on table public.enquiry_attempts from public, anon, authenticated;

-- A slug from a name, the way the app makes one, with room for a suffix.
create or replace function public.slug_from_name(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '-'), 40);
$$;

-- Only submit_enquiry() needs it.
revoke all on function public.slug_from_name(text) from public, anon, authenticated;

create or replace function public.submit_enquiry(
  organisation text,
  contact_name text,
  email text,
  phone text default null,
  message text default null,
  details jsonb default '{}'::jsonb,
  website_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  ip text := coalesce(
    nullif(headers ->> 'cf-connecting-ip', ''),
    nullif(split_part(headers ->> 'x-forwarded-for', ',', 1), ''),
    'unknown'
  );
  caller_hash text := encode(sha256(convert_to(ip, 'UTF8')), 'hex');
  address text := lower(btrim(email));
  org_name text := btrim(organisation);
  person text := btrim(contact_name);
  base text;
  candidate text;
  org public.organisations;
  contact_id uuid;
begin
  -- A bot filled in the field people cannot see. Say nothing.
  if nullif(btrim(website_url), '') is not null then
    return;
  end if;

  if char_length(org_name) not between 1 and 100 then
    raise exception 'organisation name must be 1 to 100 characters'
      using errcode = 'check_violation';
  end if;
  if char_length(person) not between 1 and 100 then
    raise exception 'contact name must be 1 to 100 characters' using errcode = 'check_violation';
  end if;
  if address !~ '^[^@[:space:]]+@[^@[:space:]]+$' or char_length(address) > 254 then
    raise exception 'email address is not valid' using errcode = 'check_violation';
  end if;
  if details is null or jsonb_typeof(details) <> 'object' then
    raise exception 'details must be an object' using errcode = 'check_violation';
  end if;

  if (
    select count(*) from public.enquiry_attempts a
    where a.ip_hash = caller_hash and a.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'too many enquiries from this address; try again later'
      using errcode = 'too_many_connections';
  end if;

  -- The same person again today: they already have a lead. Say nothing.
  if exists (
    select 1 from public.enquiry_attempts a
    where a.email = address and a.created_at > now() - interval '1 day'
  ) then
    return;
  end if;

  insert into public.enquiry_attempts (ip_hash, email) values (caller_hash, address);

  -- A slug from the name; a short suffix when that one is taken.
  base := coalesce(nullif(public.slug_from_name(org_name), ''), 'enquiry');
  if char_length(base) < 2 then
    base := base || '-org';
  end if;
  candidate := base;
  while exists (select 1 from public.organisations o where o.slug = candidate) loop
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  -- Read by create_customer_for_organisation() when the trigger fires below. Cleared after:
  -- the setting lives for the transaction, which may outlast this call.
  perform set_config('app.customer_stage', 'lead', true);
  insert into public.organisations (name, slug)
  values (org_name, candidate)
  returning * into org;
  perform set_config('app.customer_stage', '', true);

  update public.customers
  set source = 'website', details = submit_enquiry.details
  where org_id = org.id;

  insert into public.contacts (org_id, name, email, phone, is_primary, created_by)
  values (org.id, person, address, nullif(left(btrim(phone), 30), ''), true, null)
  returning id into contact_id;

  insert into public.activities (org_id, contact_id, kind, body, created_by)
  values (
    org.id,
    contact_id,
    'enquiry',
    case
      when nullif(btrim(message), '') is null then 'Enquired through the website.'
      else 'Enquired through the website: ' || left(btrim(message), 5000)
    end,
    null
  );
end;
$$;

revoke all on function public.submit_enquiry(text, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_enquiry(text, text, text, text, text, jsonb, text)
  to anon, authenticated;
