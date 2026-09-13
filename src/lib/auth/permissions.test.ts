import { describe, expect, it } from 'vitest'
import { canInOrg } from './permissions'

describe('canInOrg', () => {
  it('lets owners and admins manage the organisation', () => {
    expect(canInOrg('owner', 'org:update')).toBe(true)
    expect(canInOrg('admin', 'org:update')).toBe(true)
    expect(canInOrg('member', 'org:update')).toBe(false)
  })

  it('reserves deletion for owners', () => {
    expect(canInOrg('owner', 'org:delete')).toBe(true)
    expect(canInOrg('admin', 'org:delete')).toBe(false)
  })
})
