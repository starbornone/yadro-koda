import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Membership } from '@/lib/supabase/organisations'
import { renderAuthenticated, testMembership } from '@/test/render-authenticated'
import { OrgSwitcher } from './org-switcher'

const setActiveOrganisation = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  setActiveOrganisation,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const other: Membership = {
  org_id: 'org-2',
  role: 'member',
  expires_at: null,
  organisation: { id: 'org-2', name: 'Globex', slug: 'globex', created_at: '' },
}

beforeEach(() => {
  setActiveOrganisation.mockReset().mockResolvedValue(undefined)
})

describe('OrgSwitcher', () => {
  it('shows the active organisation and role', async () => {
    renderAuthenticated(<OrgSwitcher />)

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('lists every organisation and switches by remembering the choice', async () => {
    const user = userEvent.setup()
    const { router } = renderAuthenticated(<OrgSwitcher />, {
      memberships: [testMembership, other],
    })
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: /Acme/ }))
    expect(await screen.findByRole('menuitem', { name: /Globex/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'New organisation' })).toHaveAttribute(
      'href',
      '/app/organisations/new',
    )

    await user.click(screen.getByRole('menuitem', { name: /Globex/ }))

    expect(setActiveOrganisation).toHaveBeenCalledWith('user-1', 'org-2')
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('does nothing when the active organisation is chosen again', async () => {
    const user = userEvent.setup()
    renderAuthenticated(<OrgSwitcher />, { memberships: [testMembership, other] })

    await user.click(await screen.findByRole('button', { name: /Acme/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Acme/ }))

    expect(setActiveOrganisation).not.toHaveBeenCalled()
  })
})
