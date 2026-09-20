-- The commercial facts on the customer record — plan, annual value, expected close, renewal,
-- outcome reason — with the dates the pipeline keeps for itself, and the stage view now
-- summing value. See schemas/30_crm.sql.

alter table public.customers
  add column plan text check (plan is null or char_length(plan) between 1 and 100),
  add column annual_value numeric(12, 2) check (annual_value is null or annual_value >= 0),
  add column expected_close date,
  add column renews_on date,
  add column outcome_reason text
    check (outcome_reason is null or char_length(outcome_reason) between 1 and 500),
  add column stage_changed_at timestamptz not null default now(),
  add column won_at timestamptz;

-- What exists already: the stage was entered when the row was created, as far as we know, and
-- anyone active now was won then too.
update public.customers set stage_changed_at = created_at;
update public.customers set won_at = created_at where stage = 'active';

create index customers_renews_on_idx on public.customers (renews_on) where renews_on is not null;

-- The dates the pipeline keeps for itself: when this stage was entered (time in stage, stale
-- leads) and when the customer was first won. Clients cannot write either.
create or replace function public.track_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.stage_changed_at := now();
  if new.stage = 'active' and old.won_at is null then
    new.won_at := now();
  end if;
  return new;
end;
$$;

create trigger customers_track_stage
  before update of stage on public.customers
  for each row
  when (old.stage is distinct from new.stage)
  execute function public.track_stage();

grant update (plan, annual_value, expected_close, renews_on, outcome_reason)
  on table public.customers to authenticated;

drop view public.customer_stage_counts;

create view public.customer_stage_summary
with (security_invoker = true)
as
  select stage, count(*)::int as count, coalesce(sum(annual_value), 0)::numeric(14, 2) as value
  from public.customers
  group by stage;

revoke all on table public.customer_stage_summary from anon;
