import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homeContent } from '@/features/marketing/content'
import { renderWithRouter } from '@/test/render-with-router'
import { GetStartedPage } from './get-started-page'

const submitEnquiry = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/enquiries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/enquiries')>()),
  submitEnquiry,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const fillTheEssentials = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Organisation'), ' Initech Pty Ltd ')
  await user.type(screen.getByLabelText('Your name'), 'Peter Gibbons')
  await user.type(screen.getByLabelText('Email'), 'peter@initech.test')
}

beforeEach(() => {
  submitEnquiry.mockReset().mockResolvedValue(undefined)
})

describe('GetStartedPage', () => {
  it('sends who they are, the product’s fields and a message, then thanks them', async () => {
    const user = userEvent.setup()
    await renderWithRouter(<GetStartedPage />, { path: '/get-started' })

    expect(
      screen.getByRole('heading', { level: 1, name: homeContent.getStarted.heading }),
    ).toBeInTheDocument()
    await fillTheEssentials(user)
    await user.type(screen.getByLabelText('Phone'), '0400 000 000')
    await user.selectOptions(screen.getByLabelText('Size'), 'medium')
    await user.type(screen.getByLabelText('Expected users'), '25')
    await user.click(screen.getByLabelText('Core'))
    await user.type(screen.getByLabelText('Anything else?'), 'We have 30 participants.')
    await user.click(screen.getByRole('button', { name: homeContent.getStarted.submit }))

    expect(submitEnquiry).toHaveBeenCalledWith({
      organisation: ' Initech Pty Ltd ',
      contactName: 'Peter Gibbons',
      email: 'peter@initech.test',
      phone: '0400 000 000',
      message: 'We have 30 participants.',
      details: { size: 'medium', seats: 25, interests: ['core'] },
      websiteUrl: '',
    })
    const thanks = await screen.findByRole('status')
    expect(thanks).toHaveTextContent(homeContent.getStarted.thanks.heading)
    expect(thanks).toHaveTextContent('peter@initech.test')
    expect(screen.queryByLabelText('Organisation')).not.toBeInTheDocument()
  })

  it('passes the honeypot along untouched by people, filled by bots', async () => {
    const user = userEvent.setup()
    await renderWithRouter(<GetStartedPage />, { path: '/get-started' })

    await fillTheEssentials(user)
    // Off-screen and out of the tab order, but a script can still find it.
    const honeypot = screen.getByLabelText('Website')
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    await user.type(honeypot, 'https://spam.example')
    await user.click(screen.getByRole('button', { name: homeContent.getStarted.submit }))

    expect(submitEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({ websiteUrl: 'https://spam.example' }),
    )
    // The bot is thanked all the same; the database quietly made nothing.
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('keeps the form and says what went wrong', async () => {
    submitEnquiry.mockRejectedValue(
      new Error('too many enquiries from this address; try again later'),
    )
    const user = userEvent.setup()
    await renderWithRouter(<GetStartedPage />, { path: '/get-started' })

    await fillTheEssentials(user)
    await user.click(screen.getByRole('button', { name: homeContent.getStarted.submit }))

    expect(await screen.findByText(/Too many enquiries from your connection/)).toBeInTheDocument()
    expect(screen.getByLabelText('Organisation')).toHaveValue(' Initech Pty Ltd ')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
