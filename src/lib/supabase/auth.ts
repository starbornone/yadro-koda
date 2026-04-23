import type { Session, User } from '@supabase/supabase-js'
import { getMyProfile, type Profile } from './profiles'
import { supabase } from './supabase'

export type AuthSnapshot = {
  session: Session | null
  user: User | null
  profile: Profile | null
}

export const getAuthSnapshot = async (): Promise<AuthSnapshot> => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return {
      session: null,
      user: null,
      profile: null,
    }
  }

  const profile = await getMyProfile()

  return {
    session,
    user: session.user,
    profile,
  }
}
