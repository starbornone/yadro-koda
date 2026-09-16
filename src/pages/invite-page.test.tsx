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
import type { InvitationPreview } from '@/lib/supabase/invitations'
import { testUser } from '@/test/render-authenticated'
import { InvitePage } from './invite-page'

const auth = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: { auth } }))

const acceptInvitation = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/invitations')>()),
  acceptInvitation,
}))

const TOKEN = '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b'

const pending: InvitationPreview = {
  organisation_name: 'Acme',
  email: 'grace@example.com',
  role: 'admin',
  invited_by_name: 'Ada',
  expires_at: '2999-01-01T00:00:00Z',
  accepted_at: null,
}

const grace = { ...testUser, id: 'user-2', email: 'Grace@Example.com' } as User

/** Mirrors the app's `/invite/$token` route (same id, context and loader data) plus stubs to land on. */
const renderInvite = (invitation: InvitationPreview | null, user: User | null) => {
  const rootRoute = createRootRoute()
  const inviteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/invite/$token',
    beforeLoad: () => ({ user }),
    loader: () => invitation,
    component: InvitePage,
  })
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <div>{path}</div> })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      inviteRoute,
      stub('/'),
      stub('/app'),
      stub('/accounts'),
      stub('/login'),
      stub('/signup'),
    ]),
    history: createMemoryHistory({ initialEntries: [`/invite/${TOKEN}`] }),
  })
  return { ...render(<RouterProvider router={router} />), router }
}

beforeEach(() => {
  acceptInvitation.mockReset()
  auth.signOut.mockReset().mockResolvedValue({ error: null })
})

describe('InvitePage', () => {
  it('explains an unknown link', async () => {
    renderInvite(null, null)

    expect(
      await screen.findByRole('heading', { name: "This invitation link isn't valid" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/')
  })

  it('explains an expired link and who to ask', async () => {
    renderInvite({ ...pending, expires_at: '2020-01-01T00:00:00Z' }, grace)

    expect(
      await screen.findByRole('heading', { name: 'This invitation has expired' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ada invited you to join Acme/)).toBeInTheDocument()
  })

  it('sends a used link on to the app', async () => {
    renderInvite({ ...pending, accepted_at: '2026-09-01T00:00:00Z' }, grace)

    expect(
      await screen.findByRole('heading', { name: 'This invitation has already been used' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to the app' })).toHaveAttribute(
      'href',
      '/accounts',
    )
  })

  it('tells a signed-out visitor which address to use and brings them back afterwards', async () => {
    renderInvite(pending, null)

    expect(await screen.findByRole('heading', { name: 'Join Acme' })).toBeInTheDocument()
    expect(screen.getByText(/invited you to join Acme as admin/)).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      `/signup?redirect=${encodeURIComponent(`/invite/${TOKEN}`)}`,
    )
    expect(screen.getByRole('link', { name: 'I already have one' })).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(`/invite/${TOKEN}`)}`,
    )
  })

  it('offers to switch accounts when the session has another email', async () => {
    const user = userEvent.setup()
    renderInvite(pending, testUser)

    expect(
      await screen.findByRole('heading', { name: 'This invitation is for a different account' }),
    ).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out and switch account' }))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('accepts, refreshes the loaders and opens the app', async () => {
    acceptInvitation.mockResolvedValue({ id: 'org-1', name: 'Acme', slug: 'acme', created_at: '' })
    const user = userEvent.setup()
    const { router } = renderInvite(pending, grace)
    const invalidate = vi.spyOn(router, 'invalidate')

    expect(await screen.findByRole('heading', { name: 'Join Acme?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }))

    expect(acceptInvitation).toHaveBeenCalledWith(TOKEN)
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
    expect(invalidate).toHaveBeenCalled()
  })

  it('surfaces the database’s refusal and lets the visitor try again', async () => {
    acceptInvitation.mockRejectedValue(
      new Error('invitation was sent to a different email address'),
    )
    const user = userEvent.setup()
    renderInvite(pending, grace)

    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }))

    expect(
      await screen.findByText('invitation was sent to a different email address'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeEnabled()
  })
})
