import { supabase } from '@/lib/supabase/supabase'

/** Where Supabase sends the user after they click the email link. Must be on the project's
 *  Redirect URLs allow-list (Authentication → URL Configuration). */
export const passwordResetRedirectUrl = () =>
  new URL('/reset-password', window.location.origin).toString()

export const requestPasswordReset = (email: string) =>
  supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: passwordResetRedirectUrl() })

type LinkErrorSearch = {
  error_code?: string
  error_description?: string
}

/**
 * When a reset link is invalid or expired, Supabase redirects here with error params instead of
 * a session — in the hash for the implicit flow, in the query for PKCE. Returns user-facing copy,
 * or null when the URL carries no error.
 */
export const readResetLinkError = (search: LinkErrorSearch, hash: string): string | null => {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const code = search.error_code ?? hashParams.get('error_code')
  const description = search.error_description ?? hashParams.get('error_description')

  if (!code && !description) return null
  if (code === 'otp_expired') return 'This password reset link has expired.'
  return 'This password reset link is invalid.'
}
