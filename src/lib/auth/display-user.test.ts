import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/lib/supabase/profiles'
import { resolveDisplayUser } from './display-user'

const user = (overrides: Partial<User> = {}) =>
  ({ id: 'user-1', email: 'ada@example.com', user_metadata: {}, ...overrides }) as User

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  display_name: null,
  email: null,
  phone: null,
  provider: null,
  providers: null,
  created_at: '',
  updated_at: '',
  last_sign_in_at: null,
  active_org_id: null,
  ...overrides,
})

describe('resolveDisplayUser', () => {
  it('prefers the profile display name and email', () => {
    const result = resolveDisplayUser(
      user({ user_metadata: { display_name: 'Meta Name' } }),
      profile({ display_name: '  Ada  ', email: 'profile@example.com' }),
    )
    expect(result).toEqual({ name: 'Ada', email: 'profile@example.com', avatar: '' })
  })

  it('falls back to auth metadata, then a generic name', () => {
    expect(
      resolveDisplayUser(user({ user_metadata: { display_name: 'Meta Name' } }), null).name,
    ).toBe('Meta Name')
    expect(resolveDisplayUser(user(), profile({ display_name: '   ' })).name).toBe('User')
  })

  it('uses the auth email when the profile has none', () => {
    expect(resolveDisplayUser(user(), null).email).toBe('ada@example.com')
    expect(resolveDisplayUser(user({ email: undefined }), null).email).toBe('')
  })

  it('reads the avatar from avatar_url, then picture', () => {
    expect(resolveDisplayUser(user({ user_metadata: { avatar_url: 'a.png' } }), null).avatar).toBe(
      'a.png',
    )
    expect(
      resolveDisplayUser(user({ user_metadata: { picture: 'p.png', avatar_url: 42 } }), null)
        .avatar,
    ).toBe('p.png')
  })
})
