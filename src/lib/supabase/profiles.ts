import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

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
}

const normalizeProviders = (providers: unknown): string[] => {
  if (!Array.isArray(providers)) {
    return []
  }

  return providers.filter((provider): provider is string => typeof provider === 'string')
}

export const profileFromUser = (
  user: User,
  displayNameOverride?: string,
): Omit<Profile, 'updated_at'> => ({
  id: user.id,
  display_name: displayNameOverride?.trim() || user.user_metadata?.display_name || null,
  email: user.email ?? null,
  phone: user.phone ?? null,
  provider: typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : null,
  providers: normalizeProviders(user.app_metadata?.providers),
  created_at: user.created_at,
  last_sign_in_at: user.last_sign_in_at ?? null,
})

export const upsertProfileFromUser = async (user: User, displayNameOverride?: string) => {
  return supabase
    .from('profiles')
    .upsert(profileFromUser(user, displayNameOverride), { onConflict: 'id' })
}

export const getMyProfile = async (): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
  if (error) {
    throw error
  }

  return data
}

export type UpdateMyProfileInput = {
  display_name?: string | null
  phone?: string | null
}

export const updateMyProfile = async (updates: UpdateMyProfileInput): Promise<Profile | null> => {
  const payload: UpdateMyProfileInput = {}

  if (Object.hasOwn(updates, 'display_name')) {
    payload.display_name = updates.display_name?.trim() || null
  }

  if (Object.hasOwn(updates, 'phone')) {
    payload.phone = updates.phone?.trim() || null
  }

  const { data, error } = await supabase.from('profiles').update(payload).select('*').maybeSingle()

  if (error) {
    throw error
  }

  return data
}
