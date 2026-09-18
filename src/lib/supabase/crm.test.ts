import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addActivity,
  addContact,
  addTask,
  createLead,
  getCustomerRecord,
  getStageCounts,
  isCustomerStage,
  listMyOpenTasks,
  parseDetails,
  listRecentActivities,
  setTaskCompleted,
  updateCustomer,
} from './crm'

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return { builder, from: vi.fn((table: string) => (table ? builder : builder)), rpc: vi.fn() }
})

vi.mock('@/lib/supabase/supabase', () => ({ supabase: { from: query.from, rpc: query.rpc } }))

const chainable = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'] as const

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of chainable) query.builder[fn].mockReset().mockReturnValue(query.builder)
  query.builder.maybeSingle.mockReset()
  query.rpc.mockReset()
})

describe('isCustomerStage', () => {
  it('accepts only the enum values', () => {
    expect(isCustomerStage('trial')).toBe(true)
    expect(isCustomerStage('bogus')).toBe(false)
    expect(isCustomerStage(undefined)).toBe(false)
  })
})

describe('parseDetails', () => {
  it('keeps what a field can hold and drops the rest', () => {
    expect(
      parseDetails({
        industry: 'Care',
        seats: 12,
        budget: true,
        interests: ['core', 'reporting'],
        nested: { a: 1 },
        mixed: ['a', 2],
        nothing: null,
      }),
    ).toEqual({ industry: 'Care', seats: 12, budget: true, interests: ['core', 'reporting'] })
  })

  it('is empty for anything that is not an object', () => {
    expect(parseDetails(undefined)).toEqual({})
    expect(parseDetails(null)).toEqual({})
    expect(parseDetails('x')).toEqual({})
    expect(parseDetails(['a'])).toEqual({})
  })
})

describe('getCustomerRecord', () => {
  it('reads the four tables and unwraps staff embeds to profiles', async () => {
    const linus = { id: 'user-2', display_name: 'Linus', email: null }
    // customers → maybeSingle; the three lists resolve from their last .order().
    query.builder.maybeSingle.mockResolvedValue({
      data: {
        org_id: 'org-1',
        stage: 'lead',
        owner_id: 'user-2',
        source: null,
        details: { industry: 'Care', nested: { dropped: true } },
        updated_at: '',
        owner: { user_id: 'user-2', profile: linus },
      },
      error: null,
    })
    query.builder.order
      .mockReturnValueOnce(query.builder) // contacts: first order()
      .mockResolvedValueOnce({ data: [{ id: 'contact-1', name: 'Grace' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'act-1', kind: 'note' }], error: null })
      .mockReturnValueOnce(query.builder) // tasks: first order()
      .mockResolvedValueOnce({
        data: [{ id: 'task-1', title: 'Call', assignee: { user_id: 'user-2', profile: linus } }],
        error: null,
      })

    const record = await getCustomerRecord('org-1')

    expect(query.from.mock.calls.map(([table]) => table)).toEqual([
      'customers',
      'contacts',
      'activities',
      'tasks',
    ])
    expect(record).toEqual({
      customer: {
        org_id: 'org-1',
        stage: 'lead',
        owner_id: 'user-2',
        source: null,
        details: { industry: 'Care' },
        updated_at: '',
        owner: linus,
      },
      contacts: [{ id: 'contact-1', name: 'Grace' }],
      activities: [{ id: 'act-1', kind: 'note' }],
      tasks: [{ id: 'task-1', title: 'Call', assignee: linus }],
    })
  })

  it('is null when there is no customers row', async () => {
    const empty = { data: [], error: null }
    query.builder.maybeSingle.mockResolvedValue({ data: null, error: null })
    query.builder.order
      .mockReturnValueOnce(query.builder)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty)
      .mockReturnValueOnce(query.builder)
      .mockResolvedValueOnce(empty)

    await expect(getCustomerRecord('org-1')).resolves.toBeNull()
  })
})

describe('getStageCounts', () => {
  it('fills every stage, zero when absent', async () => {
    query.builder.select.mockResolvedValue({
      data: [
        { stage: 'lead', count: 3 },
        { stage: 'active', count: 1 },
      ],
      error: null,
    })

    await expect(getStageCounts()).resolves.toEqual({
      lead: 3,
      qualified: 0,
      trial: 0,
      active: 1,
      churned: 0,
      lost: 0,
    })
    expect(query.from).toHaveBeenCalledWith('customer_stage_counts')
  })
})

describe('listRecentActivities', () => {
  it('asks for the newest entries across every organisation, with where they happened', async () => {
    query.builder.limit.mockResolvedValueOnce({
      data: [{ id: 'act-1', kind: 'note', organisation: { id: 'org-1', name: 'Acme' } }],
      error: null,
    })

    await expect(listRecentActivities()).resolves.toEqual([
      { id: 'act-1', kind: 'note', organisation: { id: 'org-1', name: 'Acme' } },
    ])
    expect(query.from).toHaveBeenCalledWith('activities')
    expect(query.builder.select).toHaveBeenCalledWith(
      expect.stringContaining('organisation:organisations(id, name)'),
    )
    expect(query.builder.order).toHaveBeenCalledWith('occurred_at', { ascending: false })
    expect(query.builder.limit).toHaveBeenCalledWith(20)
  })

  it('takes a limit and surfaces errors', async () => {
    query.builder.limit.mockResolvedValueOnce({ data: null, error: new Error('nope') })
    await expect(listRecentActivities(5)).rejects.toThrow('nope')
    expect(query.builder.limit).toHaveBeenCalledWith(5)
  })
})

describe('listMyOpenTasks', () => {
  it('asks for the caller’s open tasks with their organisation', async () => {
    query.builder.order.mockReturnValueOnce(query.builder).mockResolvedValueOnce({
      data: [{ id: 'task-1', assignee: null, organisation: { id: 'org-1', name: 'Acme' } }],
      error: null,
    })

    await expect(listMyOpenTasks('user-1')).resolves.toEqual([
      { id: 'task-1', assignee: null, organisation: { id: 'org-1', name: 'Acme' } },
    ])
    expect(query.builder.select).toHaveBeenCalledWith(
      expect.stringContaining('organisation:organisations(id, name)'),
    )
    expect(query.builder.eq).toHaveBeenCalledWith('assigned_to', 'user-1')
    expect(query.builder.is).toHaveBeenCalledWith('completed_at', null)
  })
})

describe('writes', () => {
  it('normalises blanks to null', async () => {
    query.builder.eq.mockResolvedValue({ error: null })
    query.builder.insert.mockResolvedValue({ error: null })

    await updateCustomer('org-1', { stage: 'trial', owner_id: null, source: '   ' })
    expect(query.builder.update).toHaveBeenCalledWith({
      stage: 'trial',
      owner_id: null,
      source: null,
    })
    await updateCustomer('org-1', { details: { seats: 3 } })
    expect(query.builder.update).toHaveBeenLastCalledWith({ details: { seats: 3 } })

    await addContact('org-1', {
      name: ' Grace ',
      email: '',
      phone: null,
      title: 'CTO',
      is_primary: true,
    })
    expect(query.builder.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      name: 'Grace',
      email: null,
      phone: null,
      title: 'CTO',
      is_primary: true,
    })

    await addActivity('org-1', { kind: 'call', body: ' Rang them. ' })
    expect(query.builder.insert).toHaveBeenLastCalledWith({
      org_id: 'org-1',
      kind: 'call',
      body: 'Rang them.',
      contact_id: null,
    })

    await addTask('org-1', { title: 'Follow up', due_on: '', assigned_to: '' })
    expect(query.builder.insert).toHaveBeenLastCalledWith({
      org_id: 'org-1',
      title: 'Follow up',
      due_on: null,
      assigned_to: null,
    })
  })

  it('completes and reopens tasks by timestamp', async () => {
    query.builder.eq.mockResolvedValue({ error: null })

    await setTaskCompleted('task-1', true)
    expect(query.builder.update).toHaveBeenCalledWith({ completed_at: expect.any(String) })

    await setTaskCompleted('task-1', false)
    expect(query.builder.update).toHaveBeenLastCalledWith({ completed_at: null })
  })

  it('creates leads through the RPC', async () => {
    query.rpc.mockResolvedValue({ data: { id: 'org-9' }, error: null })

    await expect(createLead({ name: ' Initech ', slug: 'initech', source: '' })).resolves.toEqual({
      id: 'org-9',
    })
    // A blank source is omitted, which PostgREST reads as the parameter's default (null).
    expect(query.rpc).toHaveBeenCalledWith('create_lead', {
      name: 'Initech',
      slug: 'initech',
      source: undefined,
      details: undefined,
    })

    await createLead({ name: 'Initech', slug: 'initech', details: { seats: 3 } })
    expect(query.rpc).toHaveBeenLastCalledWith('create_lead', {
      name: 'Initech',
      slug: 'initech',
      source: undefined,
      details: { seats: 3 },
    })
  })

  it('throws the database error', async () => {
    query.builder.eq.mockResolvedValue({ error: new Error('permission denied') })

    await expect(updateCustomer('org-1', { stage: 'lost' })).rejects.toThrow('permission denied')
  })
})
