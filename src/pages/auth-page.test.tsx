import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './auth-page'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@/lib/supabase/supabase', () => ({ supabase: { auth } }))

beforeEach(() => {
  auth.signInWithPassword.mockReset()
  auth.signUp.mockReset()
})

describe('AuthPage', () => {
  it('shows the login form by default and can switch to sign-up and back', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)

    expect(screen.getByRole('heading', { name: 'Login to your account' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Sign up' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Sign in' }))
    expect(screen.getByRole('heading', { name: 'Login to your account' })).toBeInTheDocument()
  })

  it('signs in with a trimmed email and reports success', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<AuthPage />)

    await user.type(screen.getByLabelText('Email'), '  ada@example.com  ')
    await user.type(screen.getByLabelText('Password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'hunter22',
    })
    expect(await screen.findByText('Signed in.')).toBeInTheDocument()
  })

  it('surfaces a sign-in error', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()
    render(<AuthPage />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
    expect(screen.queryByText('Signed in.')).not.toBeInTheDocument()
  })

  it('signs up with the display name in user metadata', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'user-1' }, session: {} }, error: null })
    const user = userEvent.setup()
    render(<AuthPage />)

    await user.click(screen.getByRole('link', { name: 'Sign up' }))
    await user.type(screen.getByLabelText('Display Name'), ' Ada Lovelace ')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'hunter22',
      options: { data: { display_name: 'Ada Lovelace' } },
    })
    expect(await screen.findByText('Account created and signed in.')).toBeInTheDocument()
  })

  it('asks the user to confirm their email when sign-up returns no session', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'user-1' }, session: null }, error: null })
    const user = userEvent.setup()
    render(<AuthPage />)

    await user.click(screen.getByRole('link', { name: 'Sign up' }))
    await user.type(screen.getByLabelText('Display Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('Check your email to confirm your account.')).toBeInTheDocument()
  })
})
