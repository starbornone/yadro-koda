import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMyProfile, updateMyProfile, type Profile } from './profiles'

// Minimal chainable stand-in for the PostgREST query builder.
const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return { builder, from: vi.fn(() => builder) }
})

vi.mock('@/lib/supabase/supabase', () => ({
  supabase: { from: query.from },
}))

const profile: Profile = {
  id: 'user-1',
  display_name: 'Ada',
  email: 'ada@example.com',
  phone: null,
  provider: 'email',
  providers: ['email'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: null,
}

beforeEach(() => {
  query.from.mockClear()
  query.builder.select.mockClear()
  query.builder.update.mockClear()
  query.builder.eq.mockClear()
  query.builder.maybeSingle.mockReset()
})

describe('getMyProfile', () => {
  it("selects the caller's row by id", async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: profile, error: null })

    await expect(getMyProfile('user-1')).resolves.toEqual(profile)

    expect(query.from).toHaveBeenCalledWith('profiles')
    expect(query.builder.select).toHaveBeenCalledWith('*')
    expect(query.builder.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(query.builder.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('returns null when there is no row', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getMyProfile('user-1')).resolves.toBeNull()
  })

  it('throws the Supabase error', async () => {
    const error = new Error('permission denied')
    query.builder.maybeSingle.mockResolvedValue({ data: null, error })

    await expect(getMyProfile('user-1')).rejects.toBe(error)
  })
})

describe('updateMyProfile', () => {
  it('trims values and scopes the update to the caller', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: profile, error: null })

    await expect(
      updateMyProfile('user-1', { display_name: '  Ada  ', phone: ' +1 555 ' }),
    ).resolves.toEqual(profile)

    expect(query.builder.update).toHaveBeenCalledWith({ display_name: 'Ada', phone: '+1 555' })
    expect(query.builder.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(query.builder.select).toHaveBeenCalledWith('*')
  })

  it('turns blank strings into null', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: profile, error: null })

    await updateMyProfile('user-1', { display_name: '   ', phone: '' })

    expect(query.builder.update).toHaveBeenCalledWith({ display_name: null, phone: null })
  })

  it('only sends the fields that were provided', async () => {
    query.builder.maybeSingle.mockResolvedValue({ data: profile, error: null })

    await updateMyProfile('user-1', { display_name: 'Ada' })

    expect(query.builder.update).toHaveBeenCalledWith({ display_name: 'Ada' })
  })

  it('throws the Supabase error', async () => {
    const error = new Error('permission denied for table profiles')
    query.builder.maybeSingle.mockResolvedValue({ data: null, error })

    await expect(updateMyProfile('user-1', { display_name: 'Ada' })).rejects.toBe(error)
  })
})
