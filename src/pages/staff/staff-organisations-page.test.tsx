import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OrganisationDetail, OrganisationSummary } from '@/lib/supabase/platform'
import { renderStaff } from '@/test/render-authenticated'
import { StaffOrganisationPage } from './staff-organisation-page'
import { StaffOrganisationsPage } from './staff-organisations-page'
import { StaffOverviewPage } from './staff-overview-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const summaries: OrganisationSummary[] = [
  { id: 'org-1', name: 'Acme', slug: 'acme', created_at: '2026-01-02T00:00:00Z', member_count: 3 },
  {
    id: 'org-2',
    name: 'Globex',
    slug: 'globex',
    created_at: '2026-03-04T00:00:00Z',
    member_count: 1,
  },
]

describe('StaffOverviewPage', () => {
  it('shows the counts and links to the lists', async () => {
    renderStaff(<StaffOverviewPage />, {
      path: '/staff',
      loaderData: { organisations: 12, memberships: 40, staff: 3 },
    })

    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Organisations\s*12/ })).toHaveAttribute(
      'href',
      '/staff/organisations',
    )
    expect(screen.getByRole('link', { name: /Staff\s*3/ })).toHaveAttribute('href', '/staff/team')
  })
})

describe('StaffOrganisationsPage', () => {
  it('lists organisations with member counts and links to each', async () => {
    renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      loaderData: summaries,
    })

    expect(await screen.findByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      '/staff/organisations/org-1',
    )
    expect(screen.getByText('Acme').closest('tr')).toHaveTextContent('3')
    expect(screen.getByText('2 organisations')).toBeInTheDocument()
  })

  it('searches by updating the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      loaderData: summaries,
    })

    await user.type(await screen.findByRole('searchbox'), 'glob{Enter}')

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'glob' }))
  })

  it('explains an empty result', async () => {
    renderStaff(<StaffOrganisationsPage />, {
      path: '/staff/organisations',
      url: '/staff/organisations?q=zzz',
      loaderData: [],
    })

    expect(await screen.findByText('No organisations match that search.')).toBeInTheDocument()
  })
})

describe('StaffOrganisationPage', () => {
  it('shows the organisation and its members read-only', async () => {
    const organisation: OrganisationDetail = {
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      created_at: '2026-01-02T00:00:00Z',
      members: [
        {
          user_id: 'user-1',
          role: 'owner',
          expires_at: null,
          created_at: '2026-01-02T00:00:00Z',
          profile: { id: 'user-1', display_name: 'Ada', email: 'ada@example.com' },
        },
        {
          user_id: 'user-9',
          role: 'member',
          expires_at: '2026-12-31T00:00:00Z',
          created_at: '2026-06-01T00:00:00Z',
          profile: { id: 'user-9', display_name: null, email: 'temp@example.com' },
        },
      ],
    }
    renderStaff(<StaffOrganisationPage />, {
      path: '/staff/organisations/$orgId',
      url: '/staff/organisations/org-1',
      loaderData: organisation,
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Acme' })).toBeInTheDocument()
    expect(screen.getByText('Ada').closest('tr')).toHaveTextContent('Owner')
    expect(screen.getByText('Ada').closest('tr')).toHaveTextContent('Never')
    expect(screen.getByText('temp@example.com').closest('tr')).toHaveTextContent('Member')
    expect(screen.queryByRole('button', { name: /Remove|Change role/ })).not.toBeInTheDocument()
  })
})
