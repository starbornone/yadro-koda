import type { PriceBookKind, ProposalState } from '@/lib/supabase/proposals'

export const PRICE_BOOK_KIND_LABELS: Record<PriceBookKind, string> = {
  one_off: 'One-off',
  monthly: 'Per month',
  annual: 'Per year',
}

/** How a line's price reads next to its amount: "× 4 per month". */
export const PRICE_BOOK_KIND_SUFFIX: Record<PriceBookKind, string> = {
  one_off: '',
  monthly: ' per month',
  annual: ' per year',
}

export const PROPOSAL_STATE_LABELS: Record<ProposalState, string> = {
  draft: 'Draft',
  sent: 'Sent',
  expired: 'Expired',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}
