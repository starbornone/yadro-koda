import { Badge } from '@/components/ui/badge'
import { CUSTOMER_STAGE_LABELS } from '@/features/crm/stages'
import type { CustomerStage } from '@/lib/supabase/crm'

const VARIANTS: Record<CustomerStage, React.ComponentProps<typeof Badge>['variant']> = {
  lead: 'outline',
  qualified: 'secondary',
  trial: 'secondary',
  active: 'default',
  churned: 'destructive',
  lost: 'destructive',
}

export const StageBadge = ({ stage }: { stage: CustomerStage }) => (
  <Badge variant={VARIANTS[stage]}>{CUSTOMER_STAGE_LABELS[stage]}</Badge>
)
