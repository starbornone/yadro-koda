import type { Json } from './database.types'
import type { Organisation, PublicProfile } from './organisations'
import { requireRow } from './require-row'
import { supabase } from './supabase'

/**
 * The CRM: what staff know about each organisation across its lifecycle. Every organisation
 * has one `customers` row (stage, owner, source), plus contacts, a timeline of activities and
 * follow-up tasks. RLS lets any staff member read and log; moving the pipeline needs
 * `platform_can_manage_customers()`. Tenants cannot see any of it.
 */

/** Mirrors the `customer_stage` enum, in funnel order. */
export const CUSTOMER_STAGES = [
  'lead',
  'qualified',
  'trial',
  'active',
  'churned',
  'lost',
] as const satisfies readonly string[]

export type CustomerStage = (typeof CUSTOMER_STAGES)[number]

export const isCustomerStage = (value: unknown): value is CustomerStage =>
  typeof value === 'string' && (CUSTOMER_STAGES as readonly string[]).includes(value)

/**
 * Mirrors the `activity_kind` enum. `stage_change`, `joined` and `enquiry` rows are written by
 * the database.
 */
export type ActivityKind =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'stage_change'
  | 'joined'
  | 'enquiry'

/** What the database records on its own; clients cannot log these. */
export type SystemActivityKind = 'stage_change' | 'joined' | 'enquiry'

/** One value in `customers.details`: what a product-defined field holds. */
export type DetailValue = string | number | boolean | string[]

/**
 * What the product records about a customer beyond the pipeline, keyed by field. The database
 * stores an object; which keys mean what is the product's field schema
 * (`src/config/customer-fields.ts`). Keys the schema no longer names are kept, not shown.
 */
export type CustomerDetails = Record<string, DetailValue>

const isDetailValue = (value: unknown): value is DetailValue =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'))

/** The stored object as details: keeps what a field can hold, drops anything else. */
export const parseDetails = (raw: Json | undefined): CustomerDetails => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, DetailValue] => isDetailValue(entry[1])),
  )
}

export type Customer = {
  org_id: string
  stage: CustomerStage
  owner_id: string | null
  source: string | null
  details: CustomerDetails
  /** Which of the product's plans; free text until a price book names them. */
  plan: string | null
  /** What the customer is worth a year, in the site's currency. */
  annual_value: number | null
  /** When the deal should close, while it is open (`YYYY-MM-DD`). */
  expected_close: string | null
  /** When the subscription renews, once it is won (`YYYY-MM-DD`). */
  renews_on: string | null
  /** Why it was lost or churned. */
  outcome_reason: string | null
  /** When the current stage was entered. Kept by the database. */
  stage_changed_at: string
  /** When the customer first became active. Kept by the database. */
  won_at: string | null
  updated_at: string
  /** The account manager's profile, when there is one. */
  owner: PublicProfile | null
}

/** One stage of the pipeline: how many organisations, and what they are worth a year. */
export type StageSummary = { count: number; value: number }

/** An active customer whose renewal is coming up (or has slipped past). */
export type Renewal = {
  org_id: string
  plan: string | null
  annual_value: number | null
  renews_on: string
  organisation: Pick<Organisation, 'id' | 'name'>
}

export type Contact = {
  id: string
  org_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  is_primary: boolean
  user_id: string | null
  created_by: string | null
  created_at: string
}

export type Activity = {
  id: string
  org_id: string
  contact_id: string | null
  kind: ActivityKind
  body: string
  occurred_at: string
  created_by: string | null
  author: PublicProfile | null
}

export type Task = {
  id: string
  org_id: string
  title: string
  due_on: string | null
  assigned_to: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  assignee: PublicProfile | null
}

export type TaskWithOrganisation = Task & { organisation: Pick<Organisation, 'id' | 'name'> }
export type ActivityWithOrganisation = Activity & {
  organisation: Pick<Organisation, 'id' | 'name'>
}

export type CustomerRecord = {
  customer: Customer
  contacts: Contact[]
  activities: Activity[]
  tasks: Task[]
}

// Select strings stay literal types (`as const`) so the client can infer each row's shape,
// embeds included, from the generated `Database`.
const PROFILE_SELECT = 'id, display_name, email'
// A staff member reached through platform_members (owner, assignee): unwrap to the profile.
const STAFF_EMBED = `user_id, profile:profiles(${PROFILE_SELECT})` as const
type StaffEmbed = { user_id: string; profile: PublicProfile } | null
const profileOf = (staff: StaffEmbed | undefined) => staff?.profile ?? null

const CUSTOMER_SELECT =
  `org_id, stage, owner_id, source, details, plan, annual_value, expected_close, renews_on, outcome_reason, stage_changed_at, won_at, updated_at, owner:platform_members(${STAFF_EMBED})` as const
const CONTACT_SELECT =
  'id, org_id, name, email, phone, title, is_primary, user_id, created_by, created_at'
const ACTIVITY_SELECT =
  `id, org_id, contact_id, kind, body, occurred_at, created_by, author:profiles(${PROFILE_SELECT})` as const
const TASK_SELECT =
  `id, org_id, title, due_on, assigned_to, completed_at, created_by, created_at, assignee:platform_members(${STAFF_EMBED})` as const

type TaskRow = Omit<Task, 'assignee'> & { assignee: StaffEmbed }
const toTask = <T extends TaskRow>({ assignee, ...task }: T) => ({
  ...task,
  assignee: profileOf(assignee),
})

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getCustomer = async (orgId: string): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw error
  }
  if (!data) return null

  const { owner, details, ...customer } = data
  return { ...customer, details: parseDetails(details), owner: profileOf(owner) }
}

export const listContacts = async (orgId: string): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_SELECT)
    .eq('org_id', orgId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return data
}

/** Newest first. */
export const listActivities = async (orgId: string): Promise<Activity[]> => {
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}

/** Open tasks first (soonest due, undated last), then completed. */
export const listTasks = async (orgId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', orgId)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_on', { ascending: true, nullsFirst: false })

  if (error) {
    throw error
  }

  return data.map(toTask)
}

/** Everything the customer page shows, or null when the organisation has no CRM record. */
export const getCustomerRecord = async (orgId: string): Promise<CustomerRecord | null> => {
  const [customer, contacts, activities, tasks] = await Promise.all([
    getCustomer(orgId),
    listContacts(orgId),
    listActivities(orgId),
    listTasks(orgId),
  ])

  return customer ? { customer, contacts, activities, tasks } : null
}

/**
 * How many organisations sit at each stage and what they are worth a year. Every stage is
 * present, zero when empty.
 */
export const getStageSummary = async (): Promise<Record<CustomerStage, StageSummary>> => {
  const { data, error } = await supabase
    .from('customer_stage_summary')
    .select('stage, count, value')

  if (error) {
    throw error
  }

  const summary = Object.fromEntries(
    CUSTOMER_STAGES.map((stage) => [stage, { count: 0, value: 0 }]),
  ) as Record<CustomerStage, StageSummary>
  for (const row of data ?? []) {
    if (isCustomerStage(row.stage)) {
      summary[row.stage] = { count: row.count ?? 0, value: Number(row.value ?? 0) }
    }
  }
  return summary
}

/**
 * Active customers renewing within the next `withinDays` days, soonest first — including any
 * whose date has already passed without the record being updated.
 */
export const listUpcomingRenewals = async (withinDays = 90): Promise<Renewal[]> => {
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + withinDays)
  const { data, error } = await supabase
    .from('customers')
    .select('org_id, plan, annual_value, renews_on, organisation:organisations(id, name)')
    .eq('stage', 'active')
    .not('renews_on', 'is', null)
    .lte('renews_on', horizon.toISOString().slice(0, 10))
    .order('renews_on', { ascending: true })
    .limit(20)

  if (error) {
    throw error
  }

  return data.filter((row): row is typeof row & { renews_on: string } => row.renews_on !== null)
}

/** The newest entries on every customer's timeline, most recent first. */
export const listRecentActivities = async (limit = 20): Promise<ActivityWithOrganisation[]> => {
  const { data, error } = await supabase
    .from('activities')
    .select(`${ACTIVITY_SELECT}, organisation:organisations(id, name)` as const)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}

/** The caller's open tasks across every customer, soonest due first. */
export const listMyOpenTasks = async (userId: string): Promise<TaskWithOrganisation[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select(`${TASK_SELECT}, organisation:organisations(id, name)` as const)
    .eq('assigned_to', userId)
    .is('completed_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data.map(toTask)
}

// ---------------------------------------------------------------------------
// Writes. Each returns nothing; callers `router.invalidate()` so the loaders re-read.
// ---------------------------------------------------------------------------

export type CustomerPatch = Partial<
  Pick<
    Customer,
    | 'stage'
    | 'owner_id'
    | 'source'
    | 'details'
    | 'plan'
    | 'annual_value'
    | 'expected_close'
    | 'renews_on'
    | 'outcome_reason'
  >
>

// Free text and dates arrive from inputs, where "nothing" is an empty string.
const TEXT_FIELDS = ['source', 'plan', 'outcome_reason', 'expected_close', 'renews_on'] as const

export const updateCustomer = async (orgId: string, patch: CustomerPatch): Promise<void> => {
  const clean = { ...patch }
  for (const field of TEXT_FIELDS) {
    if (clean[field] !== undefined) clean[field] = blankToNull(clean[field])
  }
  const { error } = await supabase.from('customers').update(clean).eq('org_id', orgId)

  if (error) {
    throw error
  }
}

export type CreateLeadInput = {
  name: string
  slug: string
  source?: string | null
  details?: CustomerDetails
}

/** Staff enter an organisation that has no users yet. It starts at `lead`, owned by the caller. */
export const createLead = async (input: CreateLeadInput): Promise<Organisation> => {
  const { data, error } = await supabase.rpc('create_lead', {
    name: input.name.trim(),
    slug: input.slug,
    // The parameters have defaults; omitting one is how PostgREST says "not given".
    source: blankToNull(input.source) ?? undefined,
    details: input.details,
  })

  if (error) {
    throw error
  }

  return requireRow(data)
}

export type ContactInput = Pick<Contact, 'name' | 'email' | 'phone' | 'title' | 'is_primary'>

const cleanContact = (input: ContactInput) => ({
  name: input.name.trim(),
  email: blankToNull(input.email),
  phone: blankToNull(input.phone),
  title: blankToNull(input.title),
  is_primary: input.is_primary,
})

export const addContact = async (orgId: string, input: ContactInput): Promise<void> => {
  const { error } = await supabase
    .from('contacts')
    .insert({ org_id: orgId, ...cleanContact(input) })

  if (error) {
    throw error
  }
}

export const updateContact = async (contactId: string, input: ContactInput): Promise<void> => {
  const { error } = await supabase.from('contacts').update(cleanContact(input)).eq('id', contactId)

  if (error) {
    throw error
  }
}

export const removeContact = async (contactId: string): Promise<void> => {
  const { error } = await supabase.from('contacts').delete().eq('id', contactId)

  if (error) {
    throw error
  }
}

export type ActivityInput = {
  kind: Exclude<ActivityKind, SystemActivityKind>
  body: string
  contact_id?: string | null
  occurred_at?: string
}

export const addActivity = async (orgId: string, input: ActivityInput): Promise<void> => {
  const { error } = await supabase.from('activities').insert({
    org_id: orgId,
    kind: input.kind,
    body: input.body.trim(),
    contact_id: input.contact_id ?? null,
    ...(input.occurred_at && { occurred_at: input.occurred_at }),
  })

  if (error) {
    throw error
  }
}

export const removeActivity = async (activityId: string): Promise<void> => {
  const { error } = await supabase.from('activities').delete().eq('id', activityId)

  if (error) {
    throw error
  }
}

export type TaskInput = Pick<Task, 'title' | 'due_on' | 'assigned_to'>

export const addTask = async (orgId: string, input: TaskInput): Promise<void> => {
  const { error } = await supabase.from('tasks').insert({
    org_id: orgId,
    title: input.title.trim(),
    due_on: input.due_on || null,
    assigned_to: input.assigned_to || null,
  })

  if (error) {
    throw error
  }
}

export const setTaskCompleted = async (taskId: string, completed: boolean): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', taskId)

  if (error) {
    throw error
  }
}

export const removeTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    throw error
  }
}

const blankToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
