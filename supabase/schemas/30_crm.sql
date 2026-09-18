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
--   activities  the timeline: notes, calls, emails, meetings, and what the database records
--               by itself — stage changes, and people joining.
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
create type public.activity_kind as enum (
  'note', 'call', 'email', 'meeting', 'stage_change', 'joined'
);

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
  -- What the product records about a customer beyond the pipeline — size, segment, what they
  -- asked for — as an object of product-defined fields (src/config/customer-fields.ts). The
  -- database keeps it an object of modest size; the app knows the fields.
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384),
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

comment on table public.activities is
  'The customer timeline. Stage changes and joins are logged here by trigger.';

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
grant update (stage, owner_id, source, details) on table public.customers to authenticated;

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
-- Stage changes and joins are written by trigger only.
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
    and kind not in ('stage_change', 'joined')
  );

create policy "activities_update_author"
  on public.activities
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and kind not in ('stage_change', 'joined'));

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
