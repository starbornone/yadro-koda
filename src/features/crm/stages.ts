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

/** Which stages count as a live relationship (for the pipeline summary). */
export const OPEN_STAGES: readonly CustomerStage[] = ['lead', 'qualified', 'trial', 'active']

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  stage_change: 'Stage change',
  joined: 'Joined',
}

/** The kinds a person can log; `stage_change` and `joined` rows come from the database. */
export const LOGGABLE_ACTIVITY_KINDS = ['note', 'call', 'email', 'meeting'] as const
