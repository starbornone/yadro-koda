-- A member whose access has ended is still a row in the organisation's members list, but
-- shares_org_with() hid their profile from colleagues, so the list came back with a null
-- person in it and the members page crashed — for everyone, including the owner who could have
-- removed the row. Found by the E2E suite. The target's expiry no longer matters; the viewer's
-- still does.
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
  );
$$;
