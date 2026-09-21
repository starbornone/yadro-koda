import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '@/lib/supabase/crm'
import type { OrganisationDetail } from '@/lib/supabase/platform'
import type { PriceBookItem, Proposal } from '@/lib/supabase/proposals'
import { renderStaff } from '@/test/render-authenticated'
import { StaffProposalPage } from './staff-proposal-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const api = vi.hoisted(() => ({
  updateProposal: vi.fn(),
  deleteProposal: vi.fn(),
  addProposalLine: vi.fn(),
  updateProposalLine: vi.fn(),
  removeProposalLine: vi.fn(),
  sendProposal: vi.fn(),
  withdrawProposal: vi.fn(),
}))
vi.mock('@/lib/supabase/proposals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/proposals')>()),
  ...api,
}))

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(undefined)
})

const organisation: OrganisationDetail = {
  id: 'org-1',
  name: 'Initech',
  slug: 'initech',
  created_at: '2026-08-20T00:00:00Z',
  members: [],
}

const contacts: Contact[] = [
  {
    id: 'contact-1',
    org_id: 'org-1',
    name: 'Peter Gibbons',
    email: 'peter@initech.test',
    phone: null,
    title: null,
    is_primary: true,
    user_id: null,
    created_by: 'user-2',
    created_at: '',
  },
]

const priceBook: PriceBookItem[] = [
  {
    id: 'item-1',
    code: 'small',
    name: 'Small provider',
    description: null,
    kind: 'annual',
    unit_amount: 5000,
    active: true,
    position: 0,
  },
  {
    id: 'item-2',
    code: 'setup',
    name: 'Setup',
    description: null,
    kind: 'one_off',
    unit_amount: 500,
    active: true,
    position: 1,
  },
]

const base: Proposal = {
  id: 'prop-1',
  org_id: 'org-1',
  contact_id: 'contact-1',
  email: 'peter@initech.test',
  title: 'Verification pathway',
  notes: null,
  status: 'draft',
  token: '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2c',
  total_amount: 0,
  annual_amount: 0,
  expires_at: null,
  sent_at: null,
  accepted_at: null,
  accepted_by: null,
  accepted_from: null,
  declined_at: null,
  declined_reason: null,
  withdrawn_at: null,
  created_at: '2026-09-01T00:00:00Z',
  lines: [],
}

const priced: Proposal = {
  ...base,
  total_amount: 5500,
  annual_amount: 5000,
  lines: [
    {
      id: 'line-1',
      proposal_id: 'prop-1',
      price_book_item_id: 'item-2',
      description: 'Setup',
      kind: 'one_off',
      quantity: 1,
      unit_amount: 500,
      position: 0,
    },
    {
      id: 'line-2',
      proposal_id: 'prop-1',
      price_book_item_id: 'item-1',
      description: 'Small provider',
      kind: 'annual',
      quantity: 1,
      unit_amount: 5000,
      position: 1,
    },
  ],
}

const sent: Proposal = {
  ...priced,
  status: 'sent',
  sent_at: '2026-09-02T00:00:00Z',
  expires_at: '2999-01-01T00:00:00Z',
}

const renderPage = (
  proposal: Proposal,
  platformRole: 'superadmin' | 'admin' | 'support' = 'admin',
) =>
  renderStaff(<StaffProposalPage />, {
    path: '/staff/organisations/$orgId/proposals/$proposalId',
    url: '/staff/organisations/org-1/proposals/prop-1',
    loaderData: { organisation, proposal, contacts, priceBook },
    platformRole,
  })

describe('StaffProposalPage', () => {
  it('shows a draft with its recipient, lines and totals', async () => {
    renderPage(priced)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Verification pathway' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sent to').nextSibling).toHaveTextContent(
      'Peter Gibbons (peter@initech.test)',
    )
    const lines = within(screen.getByRole('region', { name: 'Lines' }))
    expect(lines.getByText('Setup').closest('tr')).toHaveTextContent(/500/)
    expect(lines.getByText('Small provider').closest('tr')).toHaveTextContent(/5,000 per year/)
    expect(lines.getByText('Total on this proposal').closest('tr')).toHaveTextContent(/5,500/)
    expect(lines.getByText('Recurring, per year').closest('tr')).toHaveTextContent(/5,000/)
    expect(screen.getByRole('button', { name: 'Send proposal' })).toBeEnabled()
  })

  it('adds a line from the price book, prefilled and editable', async () => {
    const user = userEvent.setup()
    renderPage(base)

    expect(await screen.findByRole('button', { name: 'Send proposal' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Add line/ }))
    // The first item fills the line in.
    expect(screen.getByLabelText('Description')).toHaveValue('Small provider')
    expect(screen.getByLabelText('Unit price')).toHaveValue(5000)
    await user.selectOptions(screen.getByLabelText('From the price book'), 'item-2')
    expect(screen.getByLabelText('Description')).toHaveValue('Setup')
    expect(screen.getByLabelText('Recurs')).toHaveValue('one_off')
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '2')
    await user.click(screen.getByRole('button', { name: 'Add line' }))

    expect(api.addProposalLine).toHaveBeenCalledWith('prop-1', {
      price_book_item_id: 'item-2',
      description: 'Setup',
      kind: 'one_off',
      quantity: 2,
      unit_amount: 500,
      position: 0,
    })
    await waitFor(() => expect(screen.queryByLabelText('Description')).not.toBeInTheDocument())
  })

  it('adds a bespoke line', async () => {
    const user = userEvent.setup()
    renderPage(priced)

    await user.click(await screen.findByRole('button', { name: /Add line/ }))
    await user.selectOptions(screen.getByLabelText('From the price book'), '__custom__')
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), 'Travel')
    await user.clear(screen.getByLabelText('Unit price'))
    await user.type(screen.getByLabelText('Unit price'), '120.5')
    await user.click(screen.getByRole('button', { name: 'Add line' }))

    expect(api.addProposalLine).toHaveBeenCalledWith(
      'prop-1',
      expect.objectContaining({
        price_book_item_id: null,
        description: 'Travel',
        unit_amount: 120.5,
        position: 2,
      }),
    )
  })

  it('edits and removes lines', async () => {
    const user = userEvent.setup()
    renderPage(priced)

    await user.click(await screen.findByRole('button', { name: 'Edit Setup' }))
    const price = screen.getByLabelText('Unit price')
    await user.clear(price)
    await user.type(price, '750')
    await user.click(screen.getByRole('button', { name: 'Save line' }))
    expect(api.updateProposalLine).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({ description: 'Setup', unit_amount: 750, position: 0 }),
    )

    await user.click(screen.getByRole('button', { name: 'Remove Small provider' }))
    expect(api.removeProposalLine).toHaveBeenCalledWith('line-2')
  })

  it('edits the details, readdressing to another email', async () => {
    const user = userEvent.setup()
    renderPage(priced)

    await user.click(await screen.findByRole('button', { name: /Edit details/ }))
    await user.selectOptions(screen.getByLabelText('Send to'), '__other__')
    const email = screen.getByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'Bill@Initech.test')
    await user.type(screen.getByLabelText('Notes for the recipient'), 'Terms: net 30.')
    await user.click(screen.getByRole('button', { name: 'Save details' }))

    expect(api.updateProposal).toHaveBeenCalledWith('prop-1', {
      title: 'Verification pathway',
      email: 'Bill@Initech.test',
      contact_id: null,
      notes: 'Terms: net 30.',
    })
  })

  it('sends until the end of the chosen day, or with the default when none is chosen', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(priced)
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: 'Send proposal' }))
    expect(api.sendProposal).toHaveBeenLastCalledWith('prop-1', null)
    await waitFor(() => expect(invalidate).toHaveBeenCalled())

    await user.type(screen.getByLabelText('Valid until'), '2999-06-30')
    await user.click(screen.getByRole('button', { name: 'Send proposal' }))
    const [, until] = api.sendProposal.mock.lastCall as [string, string]
    expect(until).toMatch(/^2999-06-30T|^2999-07-01T/)
  })

  it('discards a draft and returns to the record', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(priced)

    await user.click(await screen.findByRole('button', { name: 'Discard draft' }))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))

    expect(api.deleteProposal).toHaveBeenCalledWith('prop-1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/staff/organisations/org-1'))
  })

  it('shows a sent proposal read-only, with its link and a way to withdraw it', async () => {
    const user = userEvent.setup()
    renderPage(sent)

    expect(await screen.findByText('Sent', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add line/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send proposal' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Proposal link')).toHaveValue(
      `${window.location.origin}/proposal/${sent.token}`,
    )

    await user.click(screen.getByRole('button', { name: 'Withdraw proposal' }))
    await user.click(await screen.findByRole('button', { name: 'Withdraw' }))
    expect(api.withdrawProposal).toHaveBeenCalledWith('prop-1')
  })

  it('shows the signature once accepted', async () => {
    renderPage({
      ...sent,
      status: 'accepted',
      accepted_at: '2026-09-10T03:00:00Z',
      accepted_by: 'user-9',
      accepted_from: '203.0.113.9 Mozilla/5.0',
    })

    expect(await screen.findByText('Accepted', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Accepted from').nextSibling).toHaveTextContent(
      '203.0.113.9 Mozilla/5.0',
    )
    expect(screen.queryByLabelText('Proposal link')).not.toBeInTheDocument()
  })

  it('keeps support to reading', async () => {
    renderPage(priced, 'support')

    await screen.findByRole('heading', { level: 1, name: 'Verification pathway' })
    expect(screen.queryByRole('button', { name: /Add line/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send proposal' })).not.toBeInTheDocument()
  })
})
