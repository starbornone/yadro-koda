import { Badge } from '@/components/ui/badge'
import { PROPOSAL_STATE_LABELS } from '@/features/proposals/labels'
import type { ProposalState } from '@/lib/supabase/proposals'

const VARIANTS: Record<ProposalState, React.ComponentProps<typeof Badge>['variant']> = {
  draft: 'outline',
  sent: 'secondary',
  expired: 'destructive',
  accepted: 'default',
  declined: 'destructive',
  withdrawn: 'outline',
}

export const ProposalStatusBadge = ({ state }: { state: ProposalState }) => (
  <Badge variant={VARIANTS[state]}>{PROPOSAL_STATE_LABELS[state]}</Badge>
)
