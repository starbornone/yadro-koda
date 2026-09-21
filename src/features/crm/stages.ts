import type { ActivityKind, CustomerStage } from '@/lib/supabase/crm'

/** Labels for the generic funnel. A product renames these alongside the `customer_stage` enum. */
export const CUSTOMER_STAGE_LABELS: Record<CustomerStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  trial: 'Trial',
  active: 'Active',
  churned: 'Churned',
  lost: 'Lost',
}

/** The deals still in play: what the pipeline is worth is the value sitting in these. */
export const PIPELINE_STAGES: readonly CustomerStage[] = ['lead', 'qualified', 'trial']

/** Won: the customers paying today, whose value is recurring revenue. */
export const WON_STAGE: CustomerStage = 'active'

/** Over, one way or the other; the record keeps a reason. */
export const CLOSED_STAGES: readonly CustomerStage[] = ['churned', 'lost']

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  stage_change: 'Stage change',
  joined: 'Joined',
  enquiry: 'Enquiry',
  proposal: 'Proposal',
}

/** The kinds a person can log; the rest come from the database. */
export const LOGGABLE_ACTIVITY_KINDS = ['note', 'call', 'email', 'meeting'] as const
