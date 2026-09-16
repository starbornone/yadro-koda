import type { User } from '@supabase/supabase-js'
import type { PublicProfile } from '@/lib/supabase/organisations'
import type { Profile } from '@/lib/supabase/profiles'

export type DisplayUser = {
  name: string
  email: string
  avatar: string
}

const metadataString = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : null
}

/** What the UI shows for the signed-in user: profile first, auth metadata as fallback. */
export const resolveDisplayUser = (user: User, profile: Profile | null): DisplayUser => ({
  name:
    profile?.display_name?.trim() || metadataString(user.user_metadata, 'display_name') || 'User',
  email: profile?.email || user.email || '',
  avatar:
    metadataString(user.user_metadata, 'avatar_url') ??
    metadataString(user.user_metadata, 'picture') ??
    '',
})

/** How another person is named in lists: display name, else email, else a placeholder. */
export const personName = (profile: PublicProfile | null | undefined) =>
  profile?.display_name?.trim() || profile?.email || 'Unnamed'
