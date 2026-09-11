import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  passwordResetRedirectUrl,
  readResetLinkError,
  requestPasswordReset,
} from './password-reset'

const resetPasswordForEmail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail } },
}))

beforeEach(() => {
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('requestPasswordReset', () => {
  it('sends a trimmed email with the reset page as the redirect target', async () => {
    await requestPasswordReset('  ada@example.com  ')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('ada@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    expect(passwordResetRedirectUrl()).toBe(`${window.location.origin}/reset-password`)
  })
})

describe('readResetLinkError', () => {
  it('returns null when the URL carries no error', () => {
    expect(readResetLinkError({}, '')).toBeNull()
    expect(readResetLinkError({}, '#access_token=abc&type=recovery')).toBeNull()
  })

  it('recognises an expired link from the hash (implicit flow)', () => {
    expect(
      readResetLinkError({}, '#error=access_denied&error_code=otp_expired&error_description=x'),
    ).toBe('This password reset link has expired.')
  })

  it('recognises an expired link from the query (PKCE flow)', () => {
    expect(readResetLinkError({ error_code: 'otp_expired' }, '')).toBe(
      'This password reset link has expired.',
    )
  })

  it('treats any other error as an invalid link', () => {
    expect(readResetLinkError({ error_code: 'access_denied' }, '')).toBe(
      'This password reset link is invalid.',
    )
    expect(readResetLinkError({}, 'error_description=Something+odd')).toBe(
      'This password reset link is invalid.',
    )
  })
})
