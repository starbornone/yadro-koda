import { supabase } from './supabase'

/**
 * Mirrors `public.profiles` (see supabase/migrations). Rows are created and the auth-mirrored
 * columns (`email`, `phone`, `provider`, `providers`, `last_sign_in_at`) are maintained by
 * database triggers; clients may only update `display_name`, `phone` and `active_org_id`.
 */
export type Profile = {
  id: string
  display_name: string | null
  email: string | null
  phone: string | null
  provider: string | null
  providers: string[] | null
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
  /** The organisation the user last worked in; the app falls back to their first membership. */
  active_org_id: string | null
}

// RLS already scopes these queries to the caller; the explicit `id` filter is defence in depth
// so a loosened policy can never turn them into a table-wide read or write.

export const getMyProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export type UpdateMyProfileInput = {
  display_name?: string | null
  phone?: string | null
}

export const updateMyProfile = async (
  userId: string,
  updates: UpdateMyProfileInput,
): Promise<Profile | null> => {
  const payload: UpdateMyProfileInput = {}

  if (Object.hasOwn(updates, 'display_name')) {
    payload.display_name = updates.display_name?.trim() || null
  }

  if (Object.hasOwn(updates, 'phone')) {
    payload.phone = updates.phone?.trim() || null
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}
