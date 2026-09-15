import { describe, expect, it } from 'vitest'
import {
  assignablePlatformRoles,
  canInOrg,
  canManagePlatformMember,
  canOnPlatform,
} from './permissions'

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
  it('tiers staff: everyone views, admins and up manage the team, superadmins manage tenants', () => {
    expect(canOnPlatform('support', 'platform:view-organisations')).toBe(true)
    expect(canOnPlatform('support', 'platform:manage-team')).toBe(false)
    expect(canOnPlatform('admin', 'platform:manage-team')).toBe(true)
    expect(canOnPlatform('admin', 'platform:manage-organisations')).toBe(false)
    expect(canOnPlatform('superadmin', 'platform:manage-organisations')).toBe(true)
  })

  it('lets every tier log CRM activity but only admins and up move the pipeline', () => {
    expect(canOnPlatform('support', 'platform:log-activity')).toBe(true)
    expect(canOnPlatform('support', 'platform:manage-customers')).toBe(false)
    expect(canOnPlatform('admin', 'platform:manage-customers')).toBe(true)
    expect(canOnPlatform('superadmin', 'platform:manage-customers')).toBe(true)
  })
})

describe('platform member management', () => {
  it('never lets anyone reach above their own tier', () => {
    expect(canManagePlatformMember('superadmin', 'superadmin')).toBe(true)
    expect(canManagePlatformMember('admin', 'superadmin')).toBe(false)
    expect(canManagePlatformMember('admin', 'admin')).toBe(true)
    expect(canManagePlatformMember('admin', 'support')).toBe(true)
    expect(canManagePlatformMember('support', 'support')).toBe(false)

    expect(assignablePlatformRoles('superadmin')).toEqual(['superadmin', 'admin', 'support'])
    expect(assignablePlatformRoles('admin')).toEqual(['admin', 'support'])
    expect(assignablePlatformRoles('support')).toEqual([])
  })
})
