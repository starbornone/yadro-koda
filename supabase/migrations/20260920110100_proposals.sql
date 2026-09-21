-- Proposals: the price book, proposals with their lines, and the RPCs that send, withdraw,
-- show, accept and decline them; proposal events as a timeline kind the database writes and
-- clients cannot; accepting a proposal as a way to join. See schemas/35_proposals.sql and
-- schemas/30_crm.sql.

comment on table public.activities is
  'The customer timeline. Stage changes, joins, website enquiries and proposal events are logged here by the database.';

drop policy "activities_insert_staff" on public.activities;
create policy "activities_insert_staff"
  on public.activities
  for insert
  to authenticated
  with check (
    public.is_platform_member()
    and created_by = (select auth.uid())
    and kind not in ('stage_change', 'joined', 'enquiry', 'proposal')
  );

drop policy "activities_update_author" on public.activities;
create policy "activities_update_author"
  on public.activities
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and kind not in ('stage_change', 'joined', 'enquiry', 'proposal')
  );

-- Accepting a proposal is one more way in.
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
      when 'proposal' then 'Accepted a proposal and became the owner'
      else format('Joined as %s', new.role)
    end,
    new.user_id
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Everything below is schemas/35_proposals.sql verbatim.
-- ---------------------------------------------------------------------------

create type public.price_book_kind as enum ('one_off', 'monthly', 'annual');
create type public.proposal_status as enum ('draft', 'sent', 'accepted', 'declined', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(code) between 2 and 50),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) between 1 and 500),
  kind public.price_book_kind not null,
  unit_amount numeric(12, 2) not null check (unit_amount >= 0),
  -- Retired items stay for the proposals that used them; they are just not offered again.
  active boolean not null default true,
  -- Display order.
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.price_book_items is
  'What can be sold: plans and add-ons with a unit price. Product data, managed by staff.';

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- Who it is addressed to: an email, like an invitation, and the contact when staff picked one.
  contact_id uuid references public.contacts (id) on delete set null,
  email text not null
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$' and char_length(email) <= 254),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- Shown to the recipient under the lines: terms, what happens next.
  notes text check (notes is null or char_length(notes) between 1 and 5000),
  status public.proposal_status not null default 'draft',
  -- The secret in the link. A random uuid is 122 bits: not guessable.
  token uuid not null unique default gen_random_uuid(),
  -- Kept by trigger from the lines: everything on the proposal, and what recurs each year.
  total_amount numeric(12, 2) not null default 0,
  annual_amount numeric(12, 2) not null default 0,
  -- When the link stops working. Set when sent.
  expires_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  -- What the accepting client reported about itself (address, browser), for the record.
  accepted_from text check (accepted_from is null or char_length(accepted_from) <= 500),
  declined_at timestamptz,
  declined_reason text check (declined_reason is null or char_length(declined_reason) <= 500),
  withdrawn_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.proposals is
  'Deals offered to a customer. The token is the link secret; accepting one makes the recipient the organisation''s owner.';
comment on column public.proposals.email is
  'Stored lower-cased; accept_proposal() only lets a session with this email accept.';

create index proposals_org_id_idx on public.proposals (org_id);
-- One proposal out at a time per organisation, so there is never a question of which link.
create unique index proposals_one_sent_per_org on public.proposals (org_id) where status = 'sent';

create table public.proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  -- Where the line came from, when it came from the price book. The description, kind and
  -- price are copied so the proposal reads the same after the book changes.
  price_book_item_id uuid references public.price_book_items (id) on delete set null,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  kind public.price_book_kind not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_amount numeric(12, 2) not null check (unit_amount >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proposal_lines_proposal_id_idx on public.proposal_lines (proposal_id);

create trigger price_book_items_set_updated_at
  before update on public.price_book_items
  for each row execute function public.set_updated_at();

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

create trigger proposal_lines_set_updated_at
  before update on public.proposal_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Triggers that keep the record consistent
-- ---------------------------------------------------------------------------

-- The proposal's totals follow its lines. Definer: clients cannot write the totals themselves.
create or replace function public.recalculate_proposal_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.proposal_id, old.proposal_id);
begin
  update public.proposals p
  set
    total_amount = totals.total,
    annual_amount = totals.annual
  from (
    select
      coalesce(sum(l.quantity * l.unit_amount), 0) as total,
      coalesce(sum(
        case l.kind
          when 'annual' then l.quantity * l.unit_amount
          when 'monthly' then l.quantity * l.unit_amount * 12
          else 0
        end
      ), 0) as annual
    from public.proposal_lines l
    where l.proposal_id = target
  ) totals
  where p.id = target;
  return coalesce(new, old);
end;
$$;

create trigger proposal_lines_recalculate_totals
  after insert or update or delete on public.proposal_lines
  for each row execute function public.recalculate_proposal_totals();

-- Lines belong to a draft. Once a proposal is sent, what the recipient saw is what stays.
create or replace function public.proposal_is_draft(target_proposal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.proposals p where p.id = target_proposal and p.status = 'draft'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.price_book_items enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_lines enable row level security;

revoke all on table public.price_book_items, public.proposals, public.proposal_lines from anon;

-- price book: staff read; the tiers that move the pipeline maintain it.
revoke insert, update on table public.price_book_items from authenticated;
grant insert (code, name, description, kind, unit_amount, active, position)
  on table public.price_book_items to authenticated;
grant update (code, name, description, kind, unit_amount, active, position)
  on table public.price_book_items to authenticated;

create policy "price_book_items_select_staff"
  on public.price_book_items
  for select
  to authenticated
  using (public.is_platform_member());

create policy "price_book_items_insert_manager"
  on public.price_book_items
  for insert
  to authenticated
  with check (public.platform_can_manage_customers());

create policy "price_book_items_update_manager"
  on public.price_book_items
  for update
  to authenticated
  using (public.platform_can_manage_customers())
  with check (public.platform_can_manage_customers());

create policy "price_book_items_delete_manager"
  on public.price_book_items
  for delete
  to authenticated
  using (public.platform_can_manage_customers());

-- proposals: staff read; managers draft. A draft's own fields change directly; its status
-- moves only through send_proposal() / withdraw_proposal() and the recipient's RPCs, and a
-- draft is the only state that can be deleted.
revoke insert, update on table public.proposals from authenticated;
grant insert (org_id, contact_id, email, title, notes) on table public.proposals to authenticated;
grant update (contact_id, email, title, notes) on table public.proposals to authenticated;

create policy "proposals_select_staff"
  on public.proposals
  for select
  to authenticated
  using (public.is_platform_member());

create policy "proposals_insert_manager"
  on public.proposals
  for insert
  to authenticated
  with check (public.platform_can_manage_customers() and created_by = (select auth.uid()));

create policy "proposals_update_manager_while_draft"
  on public.proposals
  for update
  to authenticated
  using (public.platform_can_manage_customers() and status = 'draft')
  with check (public.platform_can_manage_customers() and status = 'draft');

create policy "proposals_delete_manager_while_draft"
  on public.proposals
  for delete
  to authenticated
  using (public.platform_can_manage_customers() and status = 'draft');

-- lines: staff read; managers edit while the proposal is a draft.
revoke insert, update on table public.proposal_lines from authenticated;
grant insert (proposal_id, price_book_item_id, description, kind, quantity, unit_amount, position)
  on table public.proposal_lines to authenticated;
grant update (price_book_item_id, description, kind, quantity, unit_amount, position)
  on table public.proposal_lines to authenticated;

create policy "proposal_lines_select_staff"
  on public.proposal_lines
  for select
  to authenticated
  using (public.is_platform_member());

create policy "proposal_lines_insert_manager_while_draft"
  on public.proposal_lines
  for insert
  to authenticated
  with check (public.platform_can_manage_customers() and public.proposal_is_draft(proposal_id));

create policy "proposal_lines_update_manager_while_draft"
  on public.proposal_lines
  for update
  to authenticated
  using (public.platform_can_manage_customers() and public.proposal_is_draft(proposal_id))
  with check (public.platform_can_manage_customers() and public.proposal_is_draft(proposal_id));

create policy "proposal_lines_delete_manager_while_draft"
  on public.proposal_lines
  for delete
  to authenticated
  using (public.platform_can_manage_customers() and public.proposal_is_draft(proposal_id));

-- ---------------------------------------------------------------------------
-- send_proposal(): a draft with at least one line goes out. From then on the recipient's link
-- works until `valid_until` (30 days by default) and the proposal is frozen.
-- ---------------------------------------------------------------------------

create or replace function public.send_proposal(proposal_id uuid, valid_until timestamptz default null)
returns public.proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  proposal public.proposals;
begin
  if not public.platform_can_manage_customers() then
    raise exception 'only platform admins can send proposals' using errcode = 'insufficient_privilege';
  end if;

  select * into proposal from public.proposals p where p.id = send_proposal.proposal_id for update;

  if proposal.id is null then
    raise exception 'proposal not found' using errcode = 'no_data_found';
  end if;
  if proposal.status <> 'draft' then
    raise exception 'only a draft can be sent' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.proposal_lines l where l.proposal_id = proposal.id) then
    raise exception 'a proposal needs at least one line' using errcode = 'check_violation';
  end if;
  if valid_until is not null and valid_until <= now() then
    raise exception 'the proposal would already have expired' using errcode = 'check_violation';
  end if;

  update public.proposals
  set
    status = 'sent',
    sent_at = now(),
    sent_by = caller,
    expires_at = coalesce(valid_until, now() + interval '30 days')
  where id = proposal.id
  returning * into proposal;

  insert into public.activities (org_id, contact_id, kind, body)
  values (
    proposal.org_id,
    proposal.contact_id,
    'proposal',
    format('Sent proposal “%s” to %s', proposal.title, proposal.email)
  );

  return proposal;
end;
$$;

revoke all on function public.send_proposal(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.send_proposal(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_proposal(): takes a sent proposal back. The link stops working; the row stays as
-- the record of what was offered.
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_proposal(proposal_id uuid)
returns public.proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.proposals;
begin
  if not public.platform_can_manage_customers() then
    raise exception 'only platform admins can withdraw proposals' using errcode = 'insufficient_privilege';
  end if;

  select * into proposal from public.proposals p where p.id = withdraw_proposal.proposal_id for update;

  if proposal.id is null then
    raise exception 'proposal not found' using errcode = 'no_data_found';
  end if;
  if proposal.status <> 'sent' then
    raise exception 'only a sent proposal can be withdrawn' using errcode = 'check_violation';
  end if;

  update public.proposals
  set status = 'withdrawn', withdrawn_at = now()
  where id = proposal.id
  returning * into proposal;

  insert into public.activities (org_id, contact_id, kind, body)
  values (proposal.org_id, proposal.contact_id, 'proposal', format('Withdrew proposal “%s”', proposal.title));

  return proposal;
end;
$$;

revoke all on function public.withdraw_proposal(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_proposal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_proposal(): what the recipient's screen shows, to anyone holding the link — including
-- a visitor who has not signed in yet, so they know which account to sign in with. A draft
-- has no link yet and is not returned. Nothing beyond the proposal itself is revealed.
-- ---------------------------------------------------------------------------

create or replace function public.get_proposal(token uuid)
returns table (
  organisation_name text,
  title text,
  notes text,
  email text,
  status public.proposal_status,
  sent_by_name text,
  sent_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  total_amount numeric,
  annual_amount numeric,
  lines jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    p.title,
    p.notes,
    p.email,
    p.status,
    nullif(btrim(s.display_name), ''),
    p.sent_at,
    p.expires_at,
    p.accepted_at,
    p.declined_at,
    p.total_amount,
    p.annual_amount,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'description', l.description,
            'kind', l.kind,
            'quantity', l.quantity,
            'unit_amount', l.unit_amount,
            'amount', l.quantity * l.unit_amount
          )
          order by l.position, l.created_at
        )
        from public.proposal_lines l
        where l.proposal_id = p.id
      ),
      '[]'::jsonb
    )
  from public.proposals p
  join public.organisations o on o.id = p.org_id
  left join public.profiles s on s.id = p.sent_by
  where p.token = get_proposal.token
    and p.status <> 'draft';
$$;

revoke all on function public.get_proposal(uuid) from public, anon, authenticated;
grant execute on function public.get_proposal(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_proposal(): the deal closes. The caller — signed in with the proposal's email — is
-- recorded as having accepted it, becomes the organisation's owner (keeping their role if
-- they already belong), and the customer is won: stage active, plan and annual value from the
-- proposal, renewal a year out — atomically. `accepted_from` is whatever the client reports
-- about itself; a server-side source of truth needs an edge function in front of this.
-- ---------------------------------------------------------------------------

create or replace function public.accept_proposal(token uuid, accepted_from text default null)
returns public.organisations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
  proposal public.proposals;
  plan_name text;
  org public.organisations;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into proposal from public.proposals p where p.token = accept_proposal.token for update;

  if proposal.id is null or proposal.status = 'draft' then
    raise exception 'proposal not found' using errcode = 'no_data_found';
  end if;
  if proposal.status <> 'sent' then
    raise exception 'proposal is no longer open' using errcode = 'check_violation';
  end if;
  if proposal.expires_at <= now() then
    raise exception 'proposal has expired' using errcode = 'check_violation';
  end if;

  select lower(p.email) into caller_email from public.profiles p where p.id = caller;
  if caller_email is distinct from proposal.email then
    raise exception 'proposal was sent to a different email address'
      using errcode = 'insufficient_privilege';
  end if;

  update public.proposals
  set
    status = 'accepted',
    accepted_at = now(),
    accepted_by = caller,
    accepted_from = nullif(btrim(accept_proposal.accepted_from), '')
  where id = proposal.id;

  -- Read by log_join() (30_crm.sql) when the membership trigger fires below.
  perform set_config('app.joined_via', 'proposal', true);
  insert into public.memberships (org_id, user_id, role)
  values (proposal.org_id, caller, 'owner')
  on conflict (org_id, user_id) do nothing;
  perform set_config('app.joined_via', '', true);

  -- The plan is the first annual line, when there is one; the value is what recurs.
  select l.description into plan_name
  from public.proposal_lines l
  where l.proposal_id = proposal.id and l.kind = 'annual'
  order by l.position, l.created_at
  limit 1;

  update public.customers
  set
    stage = 'active',
    plan = coalesce(plan_name, plan),
    annual_value = proposal.annual_amount,
    renews_on = case when proposal.annual_amount > 0 then (now() + interval '1 year')::date else renews_on end,
    expected_close = null
  where org_id = proposal.org_id;

  insert into public.activities (org_id, contact_id, kind, body, created_by)
  values (
    proposal.org_id,
    proposal.contact_id,
    'proposal',
    format('Accepted proposal “%s”', proposal.title),
    caller
  );

  update public.profiles set active_org_id = proposal.org_id where id = caller;

  select * into org from public.organisations o where o.id = proposal.org_id;
  return org;
end;
$$;

revoke all on function public.accept_proposal(uuid, text) from public, anon, authenticated;
grant execute on function public.accept_proposal(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- decline_proposal(): the recipient says no, with a reason if they give one. The customer's
-- stage is left to staff; the timeline records the answer.
-- ---------------------------------------------------------------------------

create or replace function public.decline_proposal(token uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
  proposal public.proposals;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into proposal from public.proposals p where p.token = decline_proposal.token for update;

  if proposal.id is null or proposal.status = 'draft' then
    raise exception 'proposal not found' using errcode = 'no_data_found';
  end if;
  if proposal.status <> 'sent' then
    raise exception 'proposal is no longer open' using errcode = 'check_violation';
  end if;
  if proposal.expires_at <= now() then
    raise exception 'proposal has expired' using errcode = 'check_violation';
  end if;

  select lower(p.email) into caller_email from public.profiles p where p.id = caller;
  if caller_email is distinct from proposal.email then
    raise exception 'proposal was sent to a different email address'
      using errcode = 'insufficient_privilege';
  end if;

  update public.proposals
  set
    status = 'declined',
    declined_at = now(),
    declined_reason = nullif(btrim(decline_proposal.reason), '')
  where id = proposal.id;

  insert into public.activities (org_id, contact_id, kind, body, created_by)
  values (
    proposal.org_id,
    proposal.contact_id,
    'proposal',
    format('Declined proposal “%s”%s', proposal.title,
      case when nullif(btrim(decline_proposal.reason), '') is null then '' else ': ' || btrim(decline_proposal.reason) end),
    caller
  );
end;
$$;

revoke all on function public.decline_proposal(uuid, text) from public, anon, authenticated;
grant execute on function public.decline_proposal(uuid, text) to authenticated;
