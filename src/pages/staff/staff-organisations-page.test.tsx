import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OrganisationSummary } from '@/lib/supabase/platform'
import { renderStaff } from '@/test/render-authenticated'
import { StaffOrganisationsPage } from './staff-organisations-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const summaries: OrganisationSummary[] = [
  {
    id: 'org-1',
    name: 'Acme',
    slug: 'acme',
    created_at: '2026-01-02T00:00:00Z',
    member_count: 3,
    stage: 'active',
    owner: { id: 'user-2', display_name: 'Linus', email: null },
  },
  {
    id: 'org-2',
    name: 'Globex',
    slug: 'globex',
    created_at: '2026-03-04T00:00:00Z',
    member_count: 0,
    stage: 'lead',
    owner: null,
  },
]

describe('StaffOrganisationsPage', () => {
  it('lists organisations with stage, owner and member count, and links to each', async () => {
    renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      loaderData: summaries,
    })

    expect(await screen.findByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      '/staff/organisations/org-1',
    )
    const acme = screen.getByText('Acme').closest('tr')
    expect(acme).toHaveTextContent('Active')
    expect(acme).toHaveTextContent('Linus')
    expect(acme).toHaveTextContent('3')
    expect(screen.getByText('Globex').closest('tr')).toHaveTextContent('Lead')
    expect(screen.getByText('2 organisations')).toBeInTheDocument()
  })

  it('offers stage filters and a new-organisation link to admins', async () => {
    renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      url: '/staff/organisations?stage=lead',
      loaderData: [summaries[1]],
      platformRole: 'admin',
    })

    expect(await screen.findByText('1 lead organisation')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Filter by stage' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trial' })).toHaveAttribute(
      'href',
      '/staff/organisations?stage=trial',
    )
    expect(screen.getByRole('link', { name: 'Lead' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute(
      'href',
      '/staff/organisations',
    )
    expect(screen.getByRole('link', { name: /New organisation/ })).toHaveAttribute(
      'href',
      '/staff/organisations/new',
    )
  })

  it('hides the new-organisation link from support', async () => {
    renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      loaderData: summaries,
      platformRole: 'support',
    })

    await screen.findByRole('link', { name: 'Acme' })
    expect(screen.queryByRole('link', { name: /New organisation/ })).not.toBeInTheDocument()
  })

  it('searches by updating the URL and keeps the stage', async () => {
    const user = userEvent.setup()
    const { router } = renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      url: '/staff/organisations?stage=trial',
      loaderData: summaries,
    })

    await user.type(await screen.findByRole('searchbox'), 'glob{Enter}')

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'glob', stage: 'trial' }))
  })

  it('explains an empty result', async () => {
    renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      url: '/staff/organisations?q=zzz',
      loaderData: [],
    })

    expect(await screen.findByText('No organisations match.')).toBeInTheDocument()
  })
})
