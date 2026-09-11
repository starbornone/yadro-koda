import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const isSet = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/**
 * False when the env vars are absent — e.g. working on the public site without a project. The
 * auth store then reports signed-out without touching Supabase, and any auth or data call that
 * is attempted fails with `SUPABASE_NOT_CONFIGURED_MESSAGE` instead of a network error.
 */
export const isSupabaseConfigured = isSet(url) && isSet(publishableKey)

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.'

if (!isSupabaseConfigured) {
  console.warn(`${SUPABASE_NOT_CONFIGURED_MESSAGE} The public site works; sign-in will not.`)
}

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey)
  : // A syntactically valid but unreachable target, with fetch short-circuited so every call
    // returns the configuration error through the normal `{ error }` channel.
    createClient('https://supabase.invalid', 'unconfigured', {
      global: { fetch: () => Promise.reject(new Error(SUPABASE_NOT_CONFIGURED_MESSAGE)) },
    })
