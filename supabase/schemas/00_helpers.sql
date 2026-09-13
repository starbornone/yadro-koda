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
