import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth/auth-store'
import { ResetPasswordPage } from './reset-password-page'

const auth = vi.hoisted(() => ({
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: { auth } }))

const fakeStore = vi.hoisted(() => {
  let snapshot: AuthState = { status: 'signed-out', session: null, user: null }
  return {
    set(next: AuthState) {
      snapshot = next
    },
    useAuth: () => snapshot,
  }
})
vi.mock('@/lib/auth/auth-store', () => ({ useAuth: fakeStore.useAuth }))

const recoverySession: AuthState = {
  status: 'signed-in',
  session: { access_token: 'token' } as Session,
  user: { id: 'user-1', email: 'ada@example.com' } as Session['user'],
  passwordRecovery: true,
}

// Mirrors the app's `/reset-password` route: the page reads `linkError` from route context.
const renderPage = (linkError: string | null) => {
  const rootRoute = createRootRoute()
  const resetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reset-password',
    beforeLoad: () => ({ linkError }),
    component: ResetPasswordPage,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([resetRoute]),
    history: createMemoryHistory({ initialEntries: ['/reset-password'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  auth.updateUser.mockReset()
  auth.resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null })
  fakeStore.set(recoverySession)
})

describe('ResetPasswordPage', () => {
  it('shows who the reset is for and rejects mismatched passwords without calling Supabase', async () => {
    const user = userEvent.setup()
    renderPage(null)

    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()

    await user.type(screen.getByLabelText('New password'), 'hunter22')
    await user.type(screen.getByLabelText('Confirm password'), 'hunter23')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password and offers the way into the app', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    renderPage(null)

    await user.type(await screen.findByLabelText('New password'), 'hunter22')
    await user.type(screen.getByLabelText('Confirm password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'hunter22' })
    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  it('surfaces an update error and stays on the form', async () => {
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { message: 'New password should be different from the old password.' },
    })
    const user = userEvent.setup()
    renderPage(null)

    await user.type(await screen.findByLabelText('New password'), 'hunter22')
    await user.type(screen.getByLabelText('Confirm password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(
      await screen.findByText('New password should be different from the old password.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled()
  })

  it('offers a fresh link when the one in the URL was bad', async () => {
    fakeStore.set({ status: 'signed-out', session: null, user: null })
    const user = userEvent.setup()
    renderPage('This password reset link has expired.')

    expect(await screen.findByRole('heading', { name: 'Link expired' })).toBeInTheDocument()
    expect(screen.getByText(/This password reset link has expired\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/')

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ada@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    expect(
      await screen.findByText('Check your email for a link to reset your password.'),
    ).toBeInTheDocument()
  })
})
