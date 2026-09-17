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

/** Mirrors the `activity_kind` enum. `stage_change` and `joined` rows are written by the database. */
export type ActivityKind = 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'joined'

/** What the database records on its own; clients cannot log these. */
export type SystemActivityKind = 'stage_change' | 'joined'

export type Customer = {
  org_id: string
  stage: CustomerStage
  owner_id: string | null
  source: string | null
  updated_at: string
  /** The account manager's profile, when there is one. */
  owner: PublicProfile | null
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
  `org_id, stage, owner_id, source, updated_at, owner:platform_members(${STAFF_EMBED})` as const
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

  const { owner, ...customer } = data
  return { ...customer, owner: profileOf(owner) }
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

/** How many organisations sit at each stage. Every stage is present, zero when empty. */
export const getStageCounts = async (): Promise<Record<CustomerStage, number>> => {
  const { data, error } = await supabase.from('customer_stage_counts').select('stage, count')

  if (error) {
    throw error
  }

  const counts = Object.fromEntries(CUSTOMER_STAGES.map((stage) => [stage, 0])) as Record<
    CustomerStage,
    number
  >
  for (const row of (data ?? []) as Array<{ stage: CustomerStage; count: number }>) {
    counts[row.stage] = row.count
  }
  return counts
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

export type CustomerPatch = Partial<Pick<Customer, 'stage' | 'owner_id' | 'source'>>

export const updateCustomer = async (orgId: string, patch: CustomerPatch): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .update({ ...patch, ...(patch.source !== undefined && { source: blankToNull(patch.source) }) })
    .eq('org_id', orgId)

  if (error) {
    throw error
  }
}

export type CreateLeadInput = { name: string; slug: string; source?: string | null }

/** Staff enter an organisation that has no users yet. It starts at `lead`, owned by the caller. */
export const createLead = async (input: CreateLeadInput): Promise<Organisation> => {
  const { data, error } = await supabase.rpc('create_lead', {
    name: input.name.trim(),
    slug: input.slug,
    // The parameter defaults to null; omitting it is how PostgREST says "no source".
    source: blankToNull(input.source) ?? undefined,
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
