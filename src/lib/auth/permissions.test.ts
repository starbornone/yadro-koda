import { describe, expect, it } from 'vitest'
import { canInOrg, canOnPlatform } from './permissions'

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

describe('canOnPlatform', () => {
  it('lets every staff role view organisations, only admins manage the team', () => {
    expect(canOnPlatform('support', 'platform:view-organisations')).toBe(true)
    expect(canOnPlatform('support', 'platform:manage-team')).toBe(false)
    expect(canOnPlatform('admin', 'platform:manage-team')).toBe(true)
  })
})
