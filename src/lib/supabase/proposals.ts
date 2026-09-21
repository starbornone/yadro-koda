import type { Database } from './database.types'
import type { Organisation } from './organisations'
import { requireRow } from './require-row'
import { supabase } from './supabase'

/**
 * Proposals: how a lead becomes a customer. Staff price a deal from the price book, send it as
 * a link, and the person it is addressed to accepts it online, signed in with that email —
 * `accept_proposal()` makes them the organisation's owner and marks the customer won. The
 * recipient reads theirs through `get_proposal()`, which works before they have signed in.
 *
 * Amounts are in the site's currency, as numbers of whole units (`numeric(12,2)` in the
 * database, like `customers.annual_value`).
 */

/** Mirrors the `price_book_kind` enum: how a line recurs. */
export const PRICE_BOOK_KINDS = ['one_off', 'monthly', 'annual'] as const
export type PriceBookKind = (typeof PRICE_BOOK_KINDS)[number]

/** Mirrors the `proposal_status` enum. */
export type ProposalStatus = Database['public']['Enums']['proposal_status']

export type PriceBookItem = {
  id: string
  code: string
  name: string
  description: string | null
  kind: PriceBookKind
  unit_amount: number
  active: boolean
  position: number
}

export type ProposalLine = {
  id: string
  proposal_id: string
  price_book_item_id: string | null
  description: string
  kind: PriceBookKind
  quantity: number
  unit_amount: number
  position: number
}

export type Proposal = {
  id: string
  org_id: string
  contact_id: string | null
  email: string
  title: string
  notes: string | null
  status: ProposalStatus
  /** The link secret. Only readable by staff. */
  token: string
  total_amount: number
  annual_amount: number
  /** When the link stops working; null until sent. */
  expires_at: string | null
  sent_at: string | null
  accepted_at: string | null
  accepted_by: string | null
  accepted_from: string | null
  declined_at: string | null
  declined_reason: string | null
  withdrawn_at: string | null
  created_at: string
  lines: ProposalLine[]
}

/** One line as the recipient sees it. */
export type ProposalPreviewLine = {
  description: string
  kind: PriceBookKind
  quantity: number
  unit_amount: number
  amount: number
}

/** What `get_proposal()` tells the person holding the link. */
export type ProposalPreview = {
  organisation_name: string
  title: string
  notes: string | null
  email: string
  status: Exclude<ProposalStatus, 'draft'>
  sent_by_name: string | null
  sent_at: string
  expires_at: string
  accepted_at: string | null
  declined_at: string | null
  total_amount: number
  annual_amount: number
  lines: ProposalPreviewLine[]
}

/** A sent proposal's state as the clock sees it; the other statuses stand on their own. */
export type ProposalState = ProposalStatus | 'expired'

export const proposalState = (
  proposal: { status: ProposalStatus; expires_at: string | null },
  now = Date.now(),
): ProposalState =>
  proposal.status === 'sent' && proposal.expires_at && Date.parse(proposal.expires_at) <= now
    ? 'expired'
    : proposal.status

/** The URL the recipient opens. Built in the browser so it follows whatever host serves the app. */
export const proposalLink = (token: string, origin = window.location.origin) =>
  `${origin}/proposal/${token}`

/** What a line is worth, and what it adds to a year — the same arithmetic as the database. */
export const lineAmount = (line: Pick<ProposalLine, 'quantity' | 'unit_amount'>) =>
  line.quantity * line.unit_amount

export const lineAnnualAmount = (line: Pick<ProposalLine, 'kind' | 'quantity' | 'unit_amount'>) =>
  line.kind === 'annual' ? lineAmount(line) : line.kind === 'monthly' ? lineAmount(line) * 12 : 0

const PRICE_BOOK_SELECT = 'id, code, name, description, kind, unit_amount, active, position'
const LINE_SELECT =
  'id, proposal_id, price_book_item_id, description, kind, quantity, unit_amount, position'
const PROPOSAL_SELECT =
  `id, org_id, contact_id, email, title, notes, status, token, total_amount, annual_amount, expires_at, sent_at, accepted_at, accepted_by, accepted_from, declined_at, declined_reason, withdrawn_at, created_at, lines:proposal_lines(${LINE_SELECT})` as const

// Tokens are uuids; anything else cannot be a proposal, so skip the round trip (and the
// database's "invalid input syntax" error) for a mistyped link.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sortLines = <T extends { position: number }>(lines: T[]) =>
  [...lines].sort((a, b) => a.position - b.position)

// ---------------------------------------------------------------------------
// The price book
// ---------------------------------------------------------------------------

/** Every item, in display order; retired ones too unless `activeOnly`. */
export const listPriceBookItems = async ({ activeOnly = false } = {}): Promise<PriceBookItem[]> => {
  let query = supabase
    .from('price_book_items')
    .select(PRICE_BOOK_SELECT)
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data
}

export type PriceBookItemInput = Pick<
  PriceBookItem,
  'code' | 'name' | 'description' | 'kind' | 'unit_amount' | 'active' | 'position'
>

const cleanItem = (input: PriceBookItemInput) => ({
  code: input.code.trim(),
  name: input.name.trim(),
  description: blankToNull(input.description),
  kind: input.kind,
  unit_amount: input.unit_amount,
  active: input.active,
  position: input.position,
})

export const createPriceBookItem = async (input: PriceBookItemInput): Promise<void> => {
  const { error } = await supabase.from('price_book_items').insert(cleanItem(input))

  if (error) {
    throw error
  }
}

export const updatePriceBookItem = async (
  itemId: string,
  input: PriceBookItemInput,
): Promise<void> => {
  const { error } = await supabase
    .from('price_book_items')
    .update(cleanItem(input))
    .eq('id', itemId)

  if (error) {
    throw error
  }
}

/** Retired items stay for the proposals that used them; they are just not offered again. */
export const setPriceBookItemActive = async (itemId: string, active: boolean): Promise<void> => {
  const { error } = await supabase.from('price_book_items').update({ active }).eq('id', itemId)

  if (error) {
    throw error
  }
}

export const deletePriceBookItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase.from('price_book_items').delete().eq('id', itemId)

  if (error) {
    throw error
  }
}

// ---------------------------------------------------------------------------
// Proposals, as staff see them
// ---------------------------------------------------------------------------

const toProposal = (row: Omit<Proposal, 'lines'> & { lines: ProposalLine[] }): Proposal => ({
  ...row,
  lines: sortLines(row.lines),
})

/** An organisation's proposals, newest first, lines included. */
export const listProposals = async (orgId: string): Promise<Proposal[]> => {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data.map(toProposal)
}

export const getProposalById = async (proposalId: string): Promise<Proposal | null> => {
  if (!UUID.test(proposalId)) return null

  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('id', proposalId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? toProposal(data) : null
}

export type ProposalInput = {
  title: string
  email: string
  contact_id?: string | null
  notes?: string | null
}

const cleanProposal = (input: ProposalInput) => ({
  title: input.title.trim(),
  email: input.email.trim().toLowerCase(),
  contact_id: input.contact_id ?? null,
  notes: blankToNull(input.notes),
})

/** Starts a draft. Returns it (empty of lines) so the editor can open on it. */
export const createProposal = async (orgId: string, input: ProposalInput): Promise<Proposal> => {
  const { data, error } = await supabase
    .from('proposals')
    .insert({ org_id: orgId, ...cleanProposal(input) })
    .select(PROPOSAL_SELECT)
    .single()

  if (error) {
    throw error
  }

  return toProposal(data)
}

/** Drafts only; the database refuses the rest. */
export const updateProposal = async (proposalId: string, input: ProposalInput): Promise<void> => {
  const { error } = await supabase
    .from('proposals')
    .update(cleanProposal(input))
    .eq('id', proposalId)

  if (error) {
    throw error
  }
}

/** Drafts only; sent proposals are withdrawn instead, so the record stays. */
export const deleteProposal = async (proposalId: string): Promise<void> => {
  const { error } = await supabase.from('proposals').delete().eq('id', proposalId)

  if (error) {
    throw error
  }
}

export type ProposalLineInput = Pick<
  ProposalLine,
  'description' | 'kind' | 'quantity' | 'unit_amount' | 'position'
> & { price_book_item_id?: string | null }

const cleanLine = (input: ProposalLineInput) => ({
  price_book_item_id: input.price_book_item_id ?? null,
  description: input.description.trim(),
  kind: input.kind,
  quantity: input.quantity,
  unit_amount: input.unit_amount,
  position: input.position,
})

export const addProposalLine = async (
  proposalId: string,
  input: ProposalLineInput,
): Promise<void> => {
  const { error } = await supabase
    .from('proposal_lines')
    .insert({ proposal_id: proposalId, ...cleanLine(input) })

  if (error) {
    throw error
  }
}

export const updateProposalLine = async (
  lineId: string,
  input: ProposalLineInput,
): Promise<void> => {
  const { error } = await supabase.from('proposal_lines').update(cleanLine(input)).eq('id', lineId)

  if (error) {
    throw error
  }
}

export const removeProposalLine = async (lineId: string): Promise<void> => {
  const { error } = await supabase.from('proposal_lines').delete().eq('id', lineId)

  if (error) {
    throw error
  }
}

/** Sends a draft: from now the link works until `validUntil` (30 days by default). */
export const sendProposal = async (
  proposalId: string,
  validUntil: string | null = null,
): Promise<void> => {
  const { error } = await supabase.rpc('send_proposal', {
    proposal_id: proposalId,
    ...(validUntil && { valid_until: validUntil }),
  })

  if (error) {
    throw error
  }
}

/** Takes a sent proposal back. The link stops working; the row stays as the record. */
export const withdrawProposal = async (proposalId: string): Promise<void> => {
  const { error } = await supabase.rpc('withdraw_proposal', { proposal_id: proposalId })

  if (error) {
    throw error
  }
}

// ---------------------------------------------------------------------------
// Proposals, as the recipient sees them
// ---------------------------------------------------------------------------

/**
 * `get_proposal()` cannot mark its nullable columns and returns the lines as JSON; the app's
 * type says what may be null and what a line holds.
 */
const toPreview = (
  row: Database['public']['Functions']['get_proposal']['Returns'][number],
): ProposalPreview => ({
  organisation_name: row.organisation_name,
  title: row.title,
  notes: row.notes,
  email: row.email,
  status: row.status as ProposalPreview['status'],
  sent_by_name: row.sent_by_name,
  sent_at: row.sent_at,
  expires_at: row.expires_at,
  accepted_at: row.accepted_at,
  declined_at: row.declined_at,
  total_amount: Number(row.total_amount),
  annual_amount: Number(row.annual_amount),
  lines: Array.isArray(row.lines) ? row.lines.map(toPreviewLine) : [],
})

const toPreviewLine = (value: unknown): ProposalPreviewLine => {
  const line = (value ?? {}) as Record<string, unknown>
  const kind = line.kind
  return {
    description: typeof line.description === 'string' ? line.description : '',
    kind: PRICE_BOOK_KINDS.includes(kind as PriceBookKind) ? (kind as PriceBookKind) : 'one_off',
    quantity: Number(line.quantity ?? 0),
    unit_amount: Number(line.unit_amount ?? 0),
    amount: Number(line.amount ?? 0),
  }
}

/** The proposal behind a link, or null when there is none (or it is still a draft). Works signed out. */
export const getProposal = async (token: string): Promise<ProposalPreview | null> => {
  if (!UUID.test(token)) return null

  const { data, error } = await supabase.rpc('get_proposal', { token }).maybeSingle()

  if (error) {
    throw error
  }

  return data ? toPreview(data) : null
}

/**
 * Accepts: the caller becomes the organisation's owner and it becomes their active one.
 * `acceptedFrom` is what the browser can say about itself, kept on the record.
 */
export const acceptProposal = async (
  token: string,
  acceptedFrom: string | null = null,
): Promise<Organisation> => {
  const { data, error } = await supabase.rpc('accept_proposal', {
    token,
    ...(acceptedFrom && { accepted_from: acceptedFrom }),
  })

  if (error) {
    throw error
  }

  return requireRow(data)
}

export const declineProposal = async (
  token: string,
  reason: string | null = null,
): Promise<void> => {
  const { error } = await supabase.rpc('decline_proposal', {
    token,
    ...(reason?.trim() && { reason: reason.trim() }),
  })

  if (error) {
    throw error
  }
}

const blankToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
