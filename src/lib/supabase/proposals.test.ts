import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptProposal,
  createProposal,
  declineProposal,
  getProposal,
  lineAnnualAmount,
  listPriceBookItems,
  listProposals,
  proposalLink,
  proposalState,
  sendProposal,
  updateProposalLine,
} from './proposals'

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return { builder, from: vi.fn((table: string) => (table ? builder : builder)), rpc: vi.fn() }
})

vi.mock('@/lib/supabase/supabase', () => ({ supabase: { from: query.from, rpc: query.rpc } }))

const chainable = ['select', 'insert', 'update', 'delete', 'eq', 'order'] as const

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of chainable) query.builder[fn].mockReset().mockReturnValue(query.builder)
  query.builder.single.mockReset()
  query.builder.maybeSingle.mockReset()
  query.rpc.mockReset()
})

describe('proposalState', () => {
  it('turns a sent proposal past its expiry into expired, and leaves the rest alone', () => {
    const now = Date.parse('2026-09-20T00:00:00Z')
    expect(proposalState({ status: 'sent', expires_at: '2026-09-21T00:00:00Z' }, now)).toBe('sent')
    expect(proposalState({ status: 'sent', expires_at: '2026-09-19T00:00:00Z' }, now)).toBe(
      'expired',
    )
    expect(proposalState({ status: 'accepted', expires_at: '2026-09-19T00:00:00Z' }, now)).toBe(
      'accepted',
    )
    expect(proposalState({ status: 'draft', expires_at: null }, now)).toBe('draft')
  })
})

describe('lineAnnualAmount', () => {
  it('counts annual lines once, monthly ones twelve times, one-off ones never', () => {
    expect(lineAnnualAmount({ kind: 'annual', quantity: 1, unit_amount: 5000 })).toBe(5000)
    expect(lineAnnualAmount({ kind: 'monthly', quantity: 4, unit_amount: 25 })).toBe(1200)
    expect(lineAnnualAmount({ kind: 'one_off', quantity: 1, unit_amount: 500 })).toBe(0)
  })
})

describe('proposalLink', () => {
  it('points at the public proposal route on the given origin', () => {
    expect(proposalLink('abc', 'https://app.test')).toBe('https://app.test/proposal/abc')
  })
})

describe('listPriceBookItems', () => {
  it('narrows to live items only when asked', async () => {
    query.builder.order.mockReturnValueOnce(query.builder).mockResolvedValueOnce({
      data: [],
      error: null,
    })
    await listPriceBookItems()
    expect(query.builder.eq).not.toHaveBeenCalled()

    query.builder.order.mockReturnValueOnce(query.builder).mockReturnValueOnce(query.builder)
    query.builder.eq.mockResolvedValueOnce({ data: [], error: null })
    await listPriceBookItems({ activeOnly: true })
    expect(query.builder.eq).toHaveBeenCalledWith('active', true)
  })
})

describe('listProposals', () => {
  it('embeds the lines and puts them in position order', async () => {
    query.builder.order.mockResolvedValue({
      data: [
        {
          id: 'prop-1',
          lines: [
            { id: 'l2', position: 1 },
            { id: 'l1', position: 0 },
          ],
        },
      ],
      error: null,
    })

    const [proposal] = await listProposals('org-1')

    expect(query.builder.select).toHaveBeenCalledWith(
      expect.stringContaining('lines:proposal_lines('),
    )
    expect(proposal!.lines.map((line) => line.id)).toEqual(['l1', 'l2'])
  })
})

describe('writes', () => {
  it('lower-cases the address and blanks the notes', async () => {
    query.builder.single.mockResolvedValue({
      data: { id: 'prop-1', lines: [] },
      error: null,
    })

    await createProposal('org-1', { title: ' Deal ', email: 'Rex@Example.com ', notes: '  ' })

    expect(query.builder.insert).toHaveBeenCalledWith({
      org_id: 'org-1',
      title: 'Deal',
      email: 'rex@example.com',
      contact_id: null,
      notes: null,
    })
  })

  it('keeps line numbers as numbers', async () => {
    query.builder.eq.mockResolvedValue({ error: null })

    await updateProposalLine('l1', {
      description: ' Seats ',
      kind: 'monthly',
      quantity: 4,
      unit_amount: 25,
      position: 2,
    })

    expect(query.builder.update).toHaveBeenCalledWith({
      price_book_item_id: null,
      description: 'Seats',
      kind: 'monthly',
      quantity: 4,
      unit_amount: 25,
      position: 2,
    })
  })

  it('sends with or without a validity date', async () => {
    query.rpc.mockResolvedValue({ error: null })

    await sendProposal('prop-1')
    expect(query.rpc).toHaveBeenLastCalledWith('send_proposal', { proposal_id: 'prop-1' })

    await sendProposal('prop-1', '2026-10-01T13:59:59.999Z')
    expect(query.rpc).toHaveBeenLastCalledWith('send_proposal', {
      proposal_id: 'prop-1',
      valid_until: '2026-10-01T13:59:59.999Z',
    })
  })

  it('throws the database error', async () => {
    query.rpc.mockResolvedValue({ error: new Error('only a draft can be sent') })
    await expect(sendProposal('prop-1')).rejects.toThrow('only a draft can be sent')
  })
})

describe('the recipient', () => {
  it('reads the preview through the RPC, parsing the lines and amounts', async () => {
    query.rpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          organisation_name: 'Initech',
          title: 'Deal',
          notes: null,
          email: 'rex@example.com',
          status: 'sent',
          sent_by_name: 'Pat',
          sent_at: '2026-09-01T00:00:00Z',
          expires_at: '2026-10-01T00:00:00Z',
          accepted_at: null,
          declined_at: null,
          total_amount: '5600.00',
          annual_amount: '6200.00',
          lines: [
            { description: 'Setup', kind: 'one_off', quantity: 1, unit_amount: 500, amount: 500 },
            { description: 'Odd', kind: 'weekly', quantity: '2', unit_amount: '3', amount: '6' },
          ],
        },
        error: null,
      }),
    })

    const preview = await getProposal('0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b')

    expect(query.rpc).toHaveBeenCalledWith('get_proposal', {
      token: '0f4b9a1e-2c3d-4e5f-8a6b-7c8d9e0f1a2b',
    })
    expect(preview).toMatchObject({
      organisation_name: 'Initech',
      total_amount: 5600,
      annual_amount: 6200,
      lines: [
        { description: 'Setup', kind: 'one_off', quantity: 1, unit_amount: 500, amount: 500 },
        { description: 'Odd', kind: 'one_off', quantity: 2, unit_amount: 3, amount: 6 },
      ],
    })
  })

  it('does not ask the database about a link that cannot be a token', async () => {
    await expect(getProposal('not-a-uuid')).resolves.toBeNull()
    expect(query.rpc).not.toHaveBeenCalled()
  })

  it('accepts with what the browser reports, and declines with a trimmed reason', async () => {
    query.rpc.mockResolvedValue({ data: { id: 'org-1' }, error: null })

    await expect(acceptProposal('tok', 'Mozilla/5.0')).resolves.toEqual({ id: 'org-1' })
    expect(query.rpc).toHaveBeenLastCalledWith('accept_proposal', {
      token: 'tok',
      accepted_from: 'Mozilla/5.0',
    })

    await declineProposal('tok', '  too dear ')
    expect(query.rpc).toHaveBeenLastCalledWith('decline_proposal', {
      token: 'tok',
      reason: 'too dear',
    })

    await declineProposal('tok', '   ')
    expect(query.rpc).toHaveBeenLastCalledWith('decline_proposal', { token: 'tok' })
  })
})
