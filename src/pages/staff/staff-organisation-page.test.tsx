import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity, Contact, Customer, Task } from '@/lib/supabase/crm'
import type { Invitation } from '@/lib/supabase/invitations'
import type { Proposal } from '@/lib/supabase/proposals'
import { formatDate, formatDay } from '@/lib/format'
import type { OrganisationDetail, PlatformMember } from '@/lib/supabase/platform'
import { renderStaff } from '@/test/render-authenticated'
import { StaffOrganisationPage } from './staff-organisation-page'

vi.mock('@/lib/supabase/supabase', () => ({ supabase: {} }))

const organisations = vi.hoisted(() => ({
  updateOrganisation: vi.fn(),
  deleteOrganisation: vi.fn(),
  updateMembershipRole: vi.fn(),
  removeMember: vi.fn(),
}))
vi.mock('@/lib/supabase/organisations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/organisations')>()),
  ...organisations,
}))

const invitationsApi = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}))
vi.mock('@/lib/supabase/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/invitations')>()),
  ...invitationsApi,
}))

const crm = vi.hoisted(() => ({
  updateCustomer: vi.fn(),
  addContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
  addActivity: vi.fn(),
  removeActivity: vi.fn(),
  addTask: vi.fn(),
  setTaskCompleted: vi.fn(),
  removeTask: vi.fn(),
}))
vi.mock('@/lib/supabase/crm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/crm')>()),
  ...crm,
}))

const proposalsApi = vi.hoisted(() => ({ createProposal: vi.fn() }))
vi.mock('@/lib/supabase/proposals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/proposals')>()),
  ...proposalsApi,
}))

beforeEach(() => {
  for (const fn of Object.values(organisations)) fn.mockReset().mockResolvedValue(undefined)
  for (const fn of Object.values(invitationsApi)) fn.mockReset().mockResolvedValue(undefined)
  for (const fn of Object.values(crm)) fn.mockReset().mockResolvedValue(undefined)
  proposalsApi.createProposal.mockReset().mockResolvedValue({ id: 'prop-9' })
})

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

const customer: Customer = {
  org_id: 'org-1',
  stage: 'lead',
  owner_id: 'user-2',
  source: 'Website',
  // The configured fields, plus a key no field names any more.
  details: {
    industry: 'Disability services',
    size: 'small',
    seats: 12,
    interests: ['core'],
    budget_confirmed: true,
    legacy_region: 'NSW',
  },
  plan: 'Small provider',
  annual_value: 5000,
  expected_close: '2026-03-31',
  renews_on: null,
  outcome_reason: null,
  stage_changed_at: '2026-01-15T10:00:00Z',
  won_at: null,
  updated_at: '2026-01-02T00:00:00Z',
  owner: { id: 'user-2', display_name: 'Linus', email: null },
}

const contacts: Contact[] = [
  {
    id: 'contact-1',
    org_id: 'org-1',
    name: 'Grace Hopper',
    email: 'grace@acme.test',
    phone: null,
    title: 'CTO',
    is_primary: true,
    user_id: null,
    created_by: 'user-2',
    created_at: '',
  },
  {
    id: 'contact-2',
    org_id: 'org-1',
    name: 'Alan Turing',
    email: null,
    phone: '0400 000 000',
    title: null,
    is_primary: false,
    user_id: null,
    created_by: 'user-1',
    created_at: '',
  },
]

const activities: Activity[] = [
  {
    id: 'act-1',
    org_id: 'org-1',
    contact_id: 'contact-1',
    kind: 'call',
    body: 'Discussed the rollout.',
    occurred_at: '2026-02-01T10:00:00Z',
    created_by: 'user-2',
    author: { id: 'user-2', display_name: 'Linus', email: null },
  },
  {
    id: 'act-2',
    org_id: 'org-1',
    contact_id: null,
    kind: 'stage_change',
    body: 'Stage changed from trial to lead',
    occurred_at: '2026-01-15T10:00:00Z',
    created_by: 'user-1',
    author: { id: 'user-1', display_name: 'Ada', email: null },
  },
  {
    id: 'act-3',
    org_id: 'org-1',
    contact_id: 'contact-1',
    kind: 'joined',
    body: 'Accepted an invitation as admin',
    occurred_at: '2026-01-10T10:00:00Z',
    created_by: 'user-9',
    author: { id: 'user-9', display_name: 'Grace Hopper', email: null },
  },
  {
    id: 'act-4',
    org_id: 'org-1',
    contact_id: 'contact-1',
    kind: 'enquiry',
    body: 'Enquired through the website: We have 30 participants.',
    occurred_at: '2026-01-01T10:00:00Z',
    created_by: null,
    author: null,
  },
]

const tasks: Task[] = [
  {
    id: 'task-1',
    org_id: 'org-1',
    title: 'Send proposal',
    due_on: '2020-01-01',
    assigned_to: 'user-1',
    completed_at: null,
    created_by: 'user-2',
    created_at: '',
    assignee: { id: 'user-1', display_name: 'Ada', email: null },
  },
  {
    id: 'task-2',
    org_id: 'org-1',
    title: 'Intro call',
    due_on: null,
    assigned_to: null,
    completed_at: '2026-01-10T00:00:00Z',
    created_by: 'user-1',
    created_at: '',
    assignee: null,
  },
]

const staff: PlatformMember[] = [
  {
    user_id: 'user-1',
    role: 'admin',
    created_at: '',
    profile: { id: 'user-1', display_name: 'Ada', email: null },
  },
  {
    user_id: 'user-2',
    role: 'superadmin',
    created_at: '',
    profile: { id: 'user-2', display_name: 'Linus', email: null },
  },
]

const invitations: Invitation[] = [
  {
    id: 'inv-1',
    org_id: 'org-1',
    email: 'grace@acme.test',
    role: 'owner',
    token: '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b',
    invited_by: 'user-2',
    expires_at: '2999-01-01T00:00:00Z',
    access_expires_at: null,
    accepted_at: null,
    created_at: '2026-09-01T00:00:00Z',
  },
]

const proposals: Proposal[] = [
  {
    id: 'prop-1',
    org_id: 'org-1',
    contact_id: 'contact-1',
    email: 'grace@acme.test',
    title: 'Verification pathway',
    notes: null,
    status: 'sent',
    token: '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2c',
    total_amount: 5500,
    annual_amount: 5000,
    expires_at: '2999-01-01T00:00:00Z',
    sent_at: '2026-09-01T00:00:00Z',
    accepted_at: null,
    accepted_by: null,
    accepted_from: null,
    declined_at: null,
    declined_reason: null,
    withdrawn_at: null,
    created_at: '2026-09-01T00:00:00Z',
    lines: [],
  },
]

const record = {
  organisation,
  customer,
  contacts,
  activities,
  tasks,
  staff,
  invitations,
  proposals,
}

const renderPage = (platformRole: 'superadmin' | 'admin' | 'support', loaderData = record) =>
  renderStaff(<StaffOrganisationPage />, {
    path: '/staff/organisations/$orgId',
    url: '/staff/organisations/org-1',
    loaderData,
    platformRole,
  })

describe('StaffOrganisationPage', () => {
  it('shows the whole customer record', async () => {
    renderPage('support')

    expect(await screen.findByRole('heading', { level: 1, name: 'Acme' })).toBeInTheDocument()
    // Owner appears in the facts and again in the read-only pipeline summary.
    expect(screen.getAllByText('Linus', { selector: 'dd' })).toHaveLength(2)
    // Details, read-only, each field's value as its label reads.
    const details = within(screen.getByRole('region', { name: 'Details' }))
    expect(details.getByText('Industry').nextSibling).toHaveTextContent('Disability services')
    expect(details.getByText('Size').nextSibling).toHaveTextContent('2–10 people')
    expect(details.getByText('Expected users').nextSibling).toHaveTextContent('12')
    expect(details.getByText('Interested in').nextSibling).toHaveTextContent('Core')
    expect(details.getByText('Budget confirmed').nextSibling).toHaveTextContent('Yes')
    expect(details.queryByText('NSW')).not.toBeInTheDocument()

    // Contacts, with the primary one marked. (Names also appear as options in the activity form.)
    const contactsTable = within(screen.getByRole('region', { name: 'Contacts' }))
    expect(contactsTable.getByText('Grace Hopper').closest('tr')).toHaveTextContent('Primary')
    expect(screen.getByRole('link', { name: 'grace@acme.test' })).toHaveAttribute(
      'href',
      'mailto:grace@acme.test',
    )
    // Timeline, with who and what.
    expect(screen.getByText('Discussed the rollout.').closest('li')).toHaveTextContent(
      /Linus · Call with Grace Hopper/,
    )
    expect(screen.getByText('Stage changed from trial to lead')).toBeInTheDocument()
    // A join is attributed to the joiner and linked to their contact, without "with …".
    const joined = screen.getByText('Accepted an invitation as admin').closest('li')!
    expect(joined).toHaveTextContent(/Grace Hopper · Joined · /)
    expect(joined).not.toHaveTextContent(/with Grace Hopper/)
    // An enquiry has no author — the website did it — and is from its contact, not with them.
    expect(screen.getByText(/We have 30 participants/).closest('li')).toHaveTextContent(
      /Website · Enquiry from Grace Hopper · /,
    )
    // Tasks: open ones listed and overdue flagged, completed ones folded away.
    expect(screen.getByText('Send proposal').closest('li')).toHaveTextContent(/Overdue/)
    expect(screen.getByRole('button', { name: 'Completed (1)' })).toBeInTheDocument()
    // Members, read-only, and no invitations section for a tier that cannot invite.
    const members = within(screen.getByRole('region', { name: 'Members' }))
    expect(members.getByText('Ada').closest('tr')).toHaveTextContent('Owner')
    expect(members.getByText('temp@example.com').closest('tr')).toHaveTextContent('Member')
    expect(members.queryByRole('button', { name: /Change role/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invitations' })).not.toBeInTheDocument()
  })

  it('keeps the pipeline read-only for support, who can still log and remove only their own', async () => {
    renderPage('support')

    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    expect(screen.queryByLabelText('Stage')).not.toBeInTheDocument()
    expect(screen.getAllByText('Lead')).toHaveLength(2)
    // The commercial facts, read-only, with the date that matters for an open deal.
    const pipeline = within(screen.getByRole('region', { name: 'Pipeline' }))
    expect(pipeline.getByText('Plan').nextSibling).toHaveTextContent('Small provider')
    expect(pipeline.getByText('Annual value').nextSibling).toHaveTextContent(/5,000/)
    expect(pipeline.getByText('Expected close').nextSibling).toHaveTextContent(
      formatDay('2026-03-31'),
    )
    expect(pipeline.getByText(/since/)).toHaveTextContent(formatDate('2026-01-15T10:00:00Z'))
    expect(pipeline.queryByText('Renews on')).not.toBeInTheDocument()
    expect(pipeline.queryByText('Reason')).not.toBeInTheDocument()
    expect(screen.getByLabelText('What happened')).toBeInTheDocument()
    expect(screen.getByLabelText('New task')).toBeInTheDocument()
    // Contact 2 and task 2 were created by user-1 (the viewer); the others were not.
    expect(screen.getByRole('button', { name: 'Remove Alan Turing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Grace Hopper' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove task Send proposal' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Organisation name')).not.toBeInTheDocument()
  })

  it('lets admins move the pipeline', async () => {
    const user = userEvent.setup()
    const { router } = renderPage('admin')
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.selectOptions(await screen.findByLabelText('Stage'), 'qualified')
    await user.selectOptions(screen.getByLabelText('Owner'), 'user-1')
    await user.clear(screen.getByLabelText(/Annual value/))
    await user.type(screen.getByLabelText(/Annual value/), '7500')
    await user.click(
      within(screen.getByRole('region', { name: 'Pipeline' })).getByRole('button', {
        name: 'Save',
      }),
    )

    expect(crm.updateCustomer).toHaveBeenCalledWith('org-1', {
      stage: 'qualified',
      owner_id: 'user-1',
      source: 'Website',
      plan: 'Small provider',
      annual_value: 7500,
      expected_close: '2026-03-31',
      renews_on: '',
      outcome_reason: '',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    // Admins may remove anyone's contact or task.
    expect(screen.getByRole('button', { name: 'Remove Grace Hopper' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove task Send proposal' })).toBeInTheDocument()
  })

  it('lets admins edit the details, keeping what no field names any more', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    const details = within(await screen.findByRole('region', { name: 'Details' }))
    const save = details.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    await user.clear(details.getByLabelText('Industry'))
    await user.type(details.getByLabelText('Industry'), ' Aged care ')
    await user.selectOptions(details.getByLabelText('Size'), 'medium')
    await user.click(details.getByLabelText('Reporting'))
    await user.click(details.getByLabelText('Budget confirmed'))
    await user.clear(details.getByLabelText('Expected users'))
    await user.type(details.getByLabelText('Expected users'), '0')
    await user.click(save)

    // Below the field's minimum: the input is invalid and nothing is saved.
    expect(details.getByLabelText('Expected users')).toBeInvalid()
    expect(crm.updateCustomer).not.toHaveBeenCalled()

    await user.clear(details.getByLabelText('Expected users'))
    await user.click(save)
    expect(crm.updateCustomer).toHaveBeenCalledWith('org-1', {
      details: {
        legacy_region: 'NSW',
        industry: 'Aged care',
        size: 'medium',
        interests: ['core', 'reporting'],
      },
    })
    expect(await details.findByRole('status')).toHaveTextContent('Saved.')
  })

  it('asks for the date or the reason the chosen stage needs', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    const stage = await screen.findByLabelText('Stage')

    // Open: when it should close. Won: when it renews. Over: why.
    expect(screen.getByLabelText('Expected close')).toHaveValue('2026-03-31')
    await user.selectOptions(stage, 'active')
    expect(screen.queryByLabelText('Expected close')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Renews on')).toBeInTheDocument()
    await user.selectOptions(stage, 'lost')
    expect(screen.queryByLabelText('Renews on')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Reason'), 'Went with a consultant')
    await user.click(
      within(screen.getByRole('region', { name: 'Pipeline' })).getByRole('button', {
        name: 'Save',
      }),
    )

    expect(crm.updateCustomer).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ stage: 'lost', outcome_reason: 'Went with a consultant' }),
    )
  })

  it('adds a contact', async () => {
    const user = userEvent.setup()
    renderPage('support')

    await user.click(await screen.findByRole('button', { name: /Add contact/ }))
    await user.type(screen.getByLabelText('Name'), '  Katherine Johnson ')
    await user.type(screen.getByLabelText('Email'), 'kj@acme.test')
    await user.click(screen.getByRole('button', { name: 'Save contact' }))

    expect(crm.addContact).toHaveBeenCalledWith('org-1', {
      name: '  Katherine Johnson ',
      title: '',
      email: 'kj@acme.test',
      phone: '',
      is_primary: false,
    })
    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
  })

  it('makes a contact primary and edits one in place', async () => {
    const user = userEvent.setup()
    renderPage('support')

    await user.click(
      await screen.findByRole('button', { name: 'Make Alan Turing the primary contact' }),
    )
    expect(crm.updateContact).toHaveBeenCalledWith(
      'contact-2',
      expect.objectContaining({ name: 'Alan Turing', is_primary: true }),
    )

    await user.click(screen.getByRole('button', { name: 'Edit Alan Turing' }))
    await user.type(screen.getByLabelText('Title'), 'Founder')
    await user.click(screen.getByRole('button', { name: 'Save contact' }))
    expect(crm.updateContact).toHaveBeenLastCalledWith('contact-2', {
      name: 'Alan Turing',
      title: 'Founder',
      email: '',
      phone: '0400 000 000',
      is_primary: false,
    })
  })

  it('logs an activity against a contact', async () => {
    const user = userEvent.setup()
    renderPage('support')

    await user.selectOptions(await screen.findByLabelText('Type'), 'meeting')
    await user.selectOptions(screen.getByLabelText('With'), 'contact-1')
    await user.type(screen.getByLabelText('What happened'), 'Kick-off went well.')
    await user.click(screen.getByRole('button', { name: 'Log activity' }))

    expect(crm.addActivity).toHaveBeenCalledWith('org-1', {
      kind: 'meeting',
      body: 'Kick-off went well.',
      contact_id: 'contact-1',
    })
    await waitFor(() => expect(screen.getByLabelText('What happened')).toHaveValue(''))
  })

  it('adds, completes and reopens tasks', async () => {
    const user = userEvent.setup()
    renderPage('support')

    await user.type(await screen.findByLabelText('New task'), 'Follow up')
    await user.type(screen.getByLabelText('Due'), '2026-10-01')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(crm.addTask).toHaveBeenCalledWith('org-1', {
      title: 'Follow up',
      due_on: '2026-10-01',
      assigned_to: 'user-1',
    })

    await user.click(screen.getByRole('checkbox', { name: 'Complete Send proposal' }))
    expect(crm.setTaskCompleted).toHaveBeenCalledWith('task-1', true)

    await user.click(screen.getByRole('button', { name: 'Completed (1)' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Reopen Intro call' }))
    expect(crm.setTaskCompleted).toHaveBeenCalledWith('task-2', false)
  })

  it('surfaces a failed write where it happened', async () => {
    crm.addActivity.mockRejectedValue(new Error('new row violates row-level security policy'))
    const user = userEvent.setup()
    renderPage('support')

    await user.type(await screen.findByLabelText('What happened'), 'x')
    await user.click(screen.getByRole('button', { name: 'Log activity' }))

    expect(await screen.findByText(/row-level security/)).toBeInTheDocument()
    expect(screen.getByLabelText('What happened')).toHaveValue('x')
  })
})

describe('StaffOrganisationPage proposals', () => {
  it('lists proposals with their state and totals, and a link to hand over', async () => {
    renderPage('support')

    const section = within(await screen.findByRole('region', { name: 'Proposals' }))
    const row = section.getByRole('link', { name: 'Verification pathway' }).closest('tr')
    expect(section.getByRole('link', { name: 'Verification pathway' })).toHaveAttribute(
      'href',
      '/staff/organisations/org-1/proposals/prop-1',
    )
    expect(row).toHaveTextContent('Sent')
    expect(row).toHaveTextContent(/5,500/)
    expect(row).toHaveTextContent(/5,000/)
    expect(
      section.getByRole('button', { name: 'Copy link for Verification pathway' }),
    ).toBeInTheDocument()
    // Support does not draft.
    expect(section.queryByRole('button', { name: /New proposal/ })).not.toBeInTheDocument()
  })

  it('starts a draft addressed to the primary contact and opens it', async () => {
    const user = userEvent.setup()
    const { router } = renderPage('admin')

    const section = within(await screen.findByRole('region', { name: 'Proposals' }))
    await user.click(section.getByRole('button', { name: /New proposal/ }))
    expect(screen.getByLabelText('Title')).toHaveValue('Proposal for Acme')
    expect(screen.getByLabelText('Send to')).toHaveValue('contact-1')
    await user.click(screen.getByRole('button', { name: 'Create draft' }))

    expect(proposalsApi.createProposal).toHaveBeenCalledWith('org-1', {
      title: 'Proposal for Acme',
      email: 'grace@acme.test',
      contact_id: 'contact-1',
    })
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/staff/organisations/org-1/proposals/prop-9'),
    )
  })

  it('takes another address when no contact fits', async () => {
    const user = userEvent.setup()
    renderPage('admin')

    const section = within(await screen.findByRole('region', { name: 'Proposals' }))
    await user.click(section.getByRole('button', { name: /New proposal/ }))
    await user.selectOptions(screen.getByLabelText('Send to'), '__other__')
    await user.type(screen.getByLabelText('Email'), 'bill@acme.test')
    await user.click(screen.getByRole('button', { name: 'Create draft' }))

    expect(proposalsApi.createProposal).toHaveBeenCalledWith('org-1', {
      title: 'Proposal for Acme',
      email: 'bill@acme.test',
      contact_id: null,
    })
  })
})

describe('StaffOrganisationPage as superadmin', () => {
  it('can rename the organisation', async () => {
    organisations.updateOrganisation.mockResolvedValue({
      id: 'org-1',
      name: 'Acme Ltd',
      slug: 'acme',
      created_at: '',
    })
    const user = userEvent.setup()
    const { router } = renderPage('superadmin')
    const invalidate = vi.spyOn(router, 'invalidate')

    const name = await screen.findByLabelText('Organisation name')
    await user.clear(name)
    await user.type(name, 'Acme Ltd')
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    expect(organisations.updateOrganisation).toHaveBeenCalledWith('org-1', { name: 'Acme Ltd' })
    expect(await screen.findByText('Organisation renamed.')).toBeInTheDocument()
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })

  it('offers no rename to admins', async () => {
    renderPage('admin')

    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    expect(screen.queryByLabelText('Organisation name')).not.toBeInTheDocument()
  })

  it('manages members as an owner would, and invites on the tenant’s behalf', async () => {
    const user = userEvent.setup()
    renderPage('superadmin')

    // user-1 (Ada) is the viewer: their own row stays untouchable even for a superadmin.
    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    expect(screen.queryByRole('button', { name: 'Change role for Ada' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change role for temp@example.com' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Owner' }))
    expect(organisations.updateMembershipRole).toHaveBeenCalledWith('org-1', 'user-9', 'owner')

    const section = within(screen.getByRole('region', { name: 'Invitations' }))
    expect(section.getByText('grace@acme.test').closest('tr')).toHaveTextContent('Owner')
    await user.type(section.getByLabelText('Email'), 'alan@acme.test')
    await user.selectOptions(section.getByLabelText('Role'), 'owner')
    await user.click(section.getByRole('button', { name: 'Create invitation' }))
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith('org-1', {
      email: 'alan@acme.test',
      role: 'owner',
      access_expires_at: null,
    })
  })

  it('offers no member management to admins', async () => {
    renderPage('admin')

    await screen.findByRole('heading', { level: 1, name: 'Acme' })
    expect(screen.queryByRole('button', { name: /Change role/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Invitations' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete organisation' })).not.toBeInTheDocument()
  })

  it('can delete the organisation on its behalf and returns to the list', async () => {
    organisations.deleteOrganisation.mockResolvedValue(organisation)
    const user = userEvent.setup()
    const { router } = renderPage('superadmin')
    const invalidate = vi.spyOn(router, 'invalidate')

    await user.click(await screen.findByRole('button', { name: 'Delete organisation' }))
    const dialog = within(await screen.findByRole('alertdialog'))
    await user.type(dialog.getByLabelText('URL name'), 'acme')
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(organisations.deleteOrganisation).toHaveBeenCalledWith('org-1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/staff/organisations'))
    expect(invalidate).toHaveBeenCalled()
  })
})
