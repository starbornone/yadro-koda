import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProposalPreview } from '@/lib/supabase/proposals'
import { testUser } from '@/test/render-authenticated'
import { ProposalPage } from './proposal-page'

const auth = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: { auth } }))

const api = vi.hoisted(() => ({ acceptProposal: vi.fn(), declineProposal: vi.fn() }))
vi.mock('@/lib/supabase/proposals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/proposals')>()),
  ...api,
}))

const TOKEN = '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b'

const open: ProposalPreview = {
  organisation_name: 'Initech',
  title: 'Verification pathway',
  notes: 'Setup within five business days.',
  email: 'rex@example.com',
  status: 'sent',
  sent_by_name: 'Pat',
  sent_at: '2026-09-01T00:00:00Z',
  expires_at: '2999-01-01T00:00:00Z',
  accepted_at: null,
  declined_at: null,
  total_amount: 5600,
  annual_amount: 6200,
  lines: [
    { description: 'Setup', kind: 'one_off', quantity: 1, unit_amount: 500, amount: 500 },
    { description: 'Small provider', kind: 'annual', quantity: 1, unit_amount: 5000, amount: 5000 },
    { description: 'Frontline seats', kind: 'monthly', quantity: 4, unit_amount: 25, amount: 100 },
  ],
}

const rex = { ...testUser, id: 'user-2', email: 'Rex@Example.com' } as User

/** Mirrors the app's `/proposal/$token` route (same id, context and loader data) plus stubs to land on. */
const renderProposal = (proposal: ProposalPreview | null, user: User | null) => {
  const rootRoute = createRootRoute()
  const proposalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/proposal/$token',
    beforeLoad: () => ({ user }),
    loader: () => proposal,
    component: ProposalPage,
  })
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <div>{path}</div> })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      proposalRoute,
      stub('/'),
      stub('/app'),
      stub('/accounts'),
      stub('/login'),
      stub('/signup'),
    ]),
    history: createMemoryHistory({ initialEntries: [`/proposal/${TOKEN}`] }),
  })
  return { ...render(<RouterProvider router={router} />), router }
}

beforeEach(() => {
  api.acceptProposal.mockReset().mockResolvedValue({ id: 'org-1' })
  api.declineProposal.mockReset().mockResolvedValue(undefined)
  auth.signOut.mockReset().mockResolvedValue({ error: null })
})

describe('ProposalPage', () => {
  it('shows a signed-out visitor the offer and which address to sign in with', async () => {
    renderProposal(open, null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Verification pathway' }),
    ).toBeInTheDocument()
    expect(screen.getByText('rex@example.com')).toBeInTheDocument()
    expect(screen.getByText('Small provider').closest('tr')).toHaveTextContent(/5,000 per year/)
    expect(screen.getByText('Frontline seats').closest('tr')).toHaveTextContent(/100 per month/)
    expect(screen.getByText('Total on this proposal').closest('tr')).toHaveTextContent(/5,600/)
    expect(screen.getByText('Recurring, per year').closest('tr')).toHaveTextContent(/6,200/)
    expect(screen.getByText('Setup within five business days.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account to accept' })).toHaveAttribute(
      'href',
      `/signup?redirect=%2Fproposal%2F${TOKEN}`,
    )
    expect(screen.getByRole('link', { name: 'I already have one' })).toHaveAttribute(
      'href',
      `/login?redirect=%2Fproposal%2F${TOKEN}`,
    )
  })

  it('lets the addressed person accept, then opens the app', async () => {
    const user = userEvent.setup()
    const { router } = renderProposal(open, rex)
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: 'Accept proposal' }))

    expect(api.acceptProposal).toHaveBeenCalledWith(TOKEN, expect.any(String))
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    expect(await screen.findByText('/app')).toBeInTheDocument()
  })

  it('lets them decline with a reason instead', async () => {
    const user = userEvent.setup()
    renderProposal(open, rex)

    await user.click(await screen.findByRole('button', { name: 'Decline' }))
    await user.type(screen.getByLabelText('Why not? (optional)'), 'Not this year.')
    await user.click(screen.getByRole('button', { name: 'Decline proposal' }))

    expect(api.declineProposal).toHaveBeenCalledWith(TOKEN, 'Not this year.')
  })

  it('surfaces a refusal from the database', async () => {
    api.acceptProposal.mockRejectedValue(new Error('proposal has expired'))
    const user = userEvent.setup()
    renderProposal(open, rex)

    await user.click(await screen.findByRole('button', { name: 'Accept proposal' }))

    expect(await screen.findByText('proposal has expired')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept proposal' })).toBeEnabled()
  })

  it('tells someone signed in with another address to switch', async () => {
    const user = userEvent.setup()
    renderProposal(open, { ...rex, email: 'nina@example.com' } as User)

    expect(
      await screen.findByRole('heading', { name: 'This proposal is for a different account' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out and switch account' }))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('explains expired, withdrawn, accepted and declined proposals, and bad links', async () => {
    renderProposal({ ...open, expires_at: '2000-01-01T00:00:00Z' }, null)
    expect(
      await screen.findByRole('heading', { name: 'This proposal has expired' }),
    ).toBeInTheDocument()
  })

  it('explains a withdrawn proposal', async () => {
    renderProposal({ ...open, status: 'withdrawn' }, rex)
    expect(
      await screen.findByRole('heading', { name: 'This proposal has been withdrawn' }),
    ).toBeInTheDocument()
  })

  it('points an accepted proposal at the app', async () => {
    renderProposal({ ...open, status: 'accepted', accepted_at: '2026-09-10T00:00:00Z' }, rex)
    expect(
      await screen.findByRole('heading', { name: 'This proposal has been accepted' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to the app' })).toHaveAttribute(
      'href',
      '/accounts',
    )
  })

  it('explains a bad link', async () => {
    renderProposal(null, null)
    expect(
      await screen.findByRole('heading', { name: "This proposal link isn't valid" }),
    ).toBeInTheDocument()
  })
})
