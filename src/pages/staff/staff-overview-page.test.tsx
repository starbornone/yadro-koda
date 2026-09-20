import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityWithOrganisation, Renewal, TaskWithOrganisation } from '@/lib/supabase/crm'
import { renderStaff } from '@/test/render-authenticated'
import { StaffOverviewPage } from './staff-overview-page'

const crm = vi.hoisted(() => ({ setTaskCompleted: vi.fn() }))
vi.mock('@/lib/supabase/crm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/crm')>()),
  ...crm,
}))
vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const acme = { id: 'org-1', name: 'Acme' }
const globex = { id: 'org-2', name: 'Globex' }

const tasks: TaskWithOrganisation[] = [
  {
    id: 'task-1',
    org_id: acme.id,
    title: 'Send proposal',
    due_on: '2000-01-01',
    assigned_to: 'user-1',
    completed_at: null,
    created_by: 'user-1',
    created_at: '2026-09-01T00:00:00Z',
    assignee: null,
    organisation: acme,
  },
]

const activities: ActivityWithOrganisation[] = [
  {
    id: 'act-1',
    org_id: acme.id,
    contact_id: 'contact-1',
    kind: 'note',
    body: 'Called to welcome them aboard.',
    occurred_at: '2026-09-18T10:00:00Z',
    created_by: 'user-1',
    author: { id: 'user-1', display_name: 'Linus', email: null },
    organisation: acme,
  },
  {
    id: 'act-2',
    org_id: globex.id,
    contact_id: null,
    kind: 'joined',
    body: 'Created the organisation',
    occurred_at: '2026-09-18T09:00:00Z',
    created_by: 'user-9',
    author: { id: 'user-9', display_name: 'Grace Hopper', email: null },
    organisation: globex,
  },
]

const renewals: Renewal[] = [
  {
    org_id: acme.id,
    plan: 'Small',
    annual_value: 5000,
    renews_on: '2000-01-01',
    organisation: acme,
  },
  {
    org_id: globex.id,
    plan: null,
    annual_value: null,
    renews_on: '2999-12-31',
    organisation: globex,
  },
]

const renderPage = (
  overrides: Partial<{ activities: ActivityWithOrganisation[]; renewals: Renewal[] }> = {},
) =>
  renderStaff(<StaffOverviewPage />, {
    path: '/staff',
    loaderData: {
      organisations: 12,
      memberships: 40,
      staff: 3,
      stages: {
        lead: { count: 4, value: 20000 },
        qualified: { count: 2, value: 15000 },
        trial: { count: 1, value: 0 },
        active: { count: 5, value: 42000 },
        churned: { count: 0, value: 0 },
        lost: { count: 0, value: 0 },
      },
      renewals,
      tasks,
      activities,
      ...overrides,
    },
  })

beforeEach(() => {
  crm.setTaskCompleted.mockReset().mockResolvedValue(undefined)
})

describe('StaffOverviewPage', () => {
  it('shows the counts, the pipeline and the viewer’s tasks', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Organisations\s*12/ })).toHaveAttribute(
      'href',
      '/staff/organisations',
    )
    expect(screen.getByRole('link', { name: /Staff\s*3/ })).toHaveAttribute('href', '/staff/team')
    const pipeline = within(screen.getByRole('region', { name: 'Pipeline' }))
    expect(pipeline.getByRole('link', { name: /Lead\s*4/ })).toHaveAttribute(
      'href',
      '/staff/organisations?stage=lead',
    )
    // What each stage is worth, where anything is; the open stages add up to the pipeline card.
    expect(pipeline.getByRole('link', { name: /Lead/ })).toHaveTextContent(/20,000/)
    expect(pipeline.getByRole('link', { name: /Trial/ })).not.toHaveTextContent(/\$/)
    const card = (label: string) =>
      screen
        .getByText(label, { selector: '[data-slot=card-description]' })
        .closest('[data-slot=card]')
    expect(card('Pipeline')).toHaveTextContent(/35,000/)
    expect(card('Annual recurring revenue')).toHaveTextContent(/42,000/)
    const task = screen.getByText('Send proposal').closest('li')!
    expect(task).toHaveTextContent(/Overdue/)
    expect(within(task).getByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      '/staff/organisations/org-1',
    )
  })

  it('lists the latest activity across organisations, each entry linking to its record', async () => {
    renderPage()

    const latest = within(await screen.findByRole('region', { name: 'Latest' }))
    const entries = latest.getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent(/Linus · Note · Acme · /)
    expect(entries[0]).toHaveTextContent('Called to welcome them aboard.')
    expect(within(entries[0]!).getByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      '/staff/organisations/org-1',
    )
    // The feed never says "with …": it has no contacts to name, and a join is its own person.
    expect(entries[1]).toHaveTextContent(/Grace Hopper · Joined · Globex · /)
    expect(entries[1]).not.toHaveTextContent(/with /)
    // Nothing on the overview can delete an entry.
    expect(latest.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument()
  })

  it('says so when nothing has been logged yet', async () => {
    renderPage({ activities: [] })
    const latest = within(await screen.findByRole('region', { name: 'Latest' }))
    expect(latest.getByText('Nothing logged yet.')).toBeInTheDocument()
  })

  it('lists renewals coming up, flags the ones that slipped, and says when there are none', async () => {
    renderPage()
    const section = within(await screen.findByRole('region', { name: 'Renewals' }))
    const rows = section.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/Acme.*Small.*5,000.*Overdue/)
    expect(within(rows[0]!).getByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      '/staff/organisations/org-1',
    )
    expect(rows[1]).toHaveTextContent(/Globex.*—/)
    expect(rows[1]).not.toHaveTextContent(/Overdue/)

    cleanup()
    renderPage({ renewals: [] })
    expect(
      within(await screen.findByRole('region', { name: 'Renewals' })).getByText(
        'Nothing renews in the next 90 days.',
      ),
    ).toBeInTheDocument()
  })

  it('completes a task from the list and refreshes', async () => {
    const user = userEvent.setup()
    const { router } = renderPage()
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('checkbox', { name: 'Complete Send proposal' }))

    expect(crm.setTaskCompleted).toHaveBeenCalledWith('task-1', true)
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })
})
