-- Supabase's default privileges grant execute on new public functions to anon and
-- authenticated directly, so the earlier `revoke … from public` left anon able to call RPCs
-- meant for signed-in users (each refused with "not signed in", but the grant was wrong).
-- Revoke from the API roles and grant back exactly who may call.

revoke all on function public.create_organisation(text, text) from public, anon, authenticated;
grant execute on function public.create_organisation(text, text) to authenticated;

revoke all on function public.get_invitation(uuid) from public, anon, authenticated;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

revoke all on function public.accept_invitation(uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

revoke all on function public.accept_platform_invitation(uuid) from public, anon, authenticated;
grant execute on function public.accept_platform_invitation(uuid) to authenticated;

revoke all on function public.create_lead(text, text, text) from public, anon, authenticated;
grant execute on function public.create_lead(text, text, text) to authenticated;
