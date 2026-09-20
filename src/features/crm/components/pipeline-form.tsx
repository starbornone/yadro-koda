import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { siteConfig } from '@/config/site'
import { StageBadge } from '@/features/crm/components/stage-badge'
import { useRouteAction } from '@/hooks/use-route-action'
import { CLOSED_STAGES, CUSTOMER_STAGE_LABELS } from '@/features/crm/stages'
import { personName } from '@/lib/auth/display-user'
import { formatDate, formatDay, formatMoney } from '@/lib/format'
import { CUSTOMER_STAGES, updateCustomer, type Customer } from '@/lib/supabase/crm'
import type { PlatformMember } from '@/lib/supabase/platform'

type PipelineFormProps = {
  customer: Customer
  staff: PlatformMember[]
  /** Whether the viewer may change the pipeline and the commercial facts (superadmin, admin). */
  canManage: boolean
}

/** The form's values: what the inputs hold, blank where the record has nothing. */
const valuesOf = (customer: Customer) => ({
  stage: customer.stage,
  ownerId: customer.owner_id ?? '',
  source: customer.source ?? '',
  plan: customer.plan ?? '',
  annualValue: customer.annual_value === null ? '' : String(customer.annual_value),
  expectedClose: customer.expected_close ?? '',
  renewsOn: customer.renews_on ?? '',
  outcomeReason: customer.outcome_reason ?? '',
})

type Values = ReturnType<typeof valuesOf>

const trimmed = (values: Values): Values => ({
  ...values,
  source: values.source.trim(),
  plan: values.plan.trim(),
  annualValue: values.annualValue.trim(),
  outcomeReason: values.outcomeReason.trim(),
})

const isSame = (a: Values, b: Values) => JSON.stringify(trimmed(a)) === JSON.stringify(trimmed(b))

/** Which date matters depends on where the customer is: closing while open, renewing once won. */
const dateFor = (stage: Customer['stage']) =>
  stage === 'active' ? 'renews' : CLOSED_STAGES.includes(stage) ? 'none' : 'close'

/**
 * Where the customer sits in the pipeline, who looks after it, and what it is worth. Read-only
 * for support; a form for the tiers that move the pipeline. Nothing else on the page writes
 * these fields, so the form keeps its own state and the record catches up on the next load.
 */
export const PipelineForm = ({ customer, staff, canManage }: PipelineFormProps) => {
  const { busy, error, run } = useRouteAction()
  const [values, setValues] = useState(() => valuesOf(customer))
  // What was last saved, so "dirty" means "differs from the database".
  const [baseline, setBaseline] = useState(values)
  const [saved, setSaved] = useState(false)

  const isDirty = !isSame(values, baseline)
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty) return
    setSaved(false)
    const next = trimmed(values)
    const ok = await run('pipeline', () =>
      updateCustomer(customer.org_id, {
        stage: next.stage,
        owner_id: next.ownerId || null,
        source: next.source,
        plan: next.plan,
        annual_value: next.annualValue === '' ? null : Number(next.annualValue),
        expected_close: next.expectedClose,
        renews_on: next.renewsOn,
        outcome_reason: next.outcomeReason,
      }),
    )
    if (ok) {
      setBaseline(next)
      setValues(next)
      setSaved(true)
    }
  }

  if (!canManage) {
    const date = dateFor(customer.stage)
    return (
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Stage</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <StageBadge stage={customer.stage} />
          <span className="text-muted-foreground">
            since {formatDate(customer.stage_changed_at)}
          </span>
        </dd>
        <dt className="text-muted-foreground">Owner</dt>
        <dd>{customer.owner ? personName(customer.owner) : 'Unassigned'}</dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd>{customer.source ?? '—'}</dd>
        <dt className="text-muted-foreground">Plan</dt>
        <dd>{customer.plan ?? '—'}</dd>
        <dt className="text-muted-foreground">Annual value</dt>
        <dd>{formatMoney(customer.annual_value)}</dd>
        {date === 'close' ? (
          <>
            <dt className="text-muted-foreground">Expected close</dt>
            <dd>{formatDay(customer.expected_close)}</dd>
          </>
        ) : null}
        {date === 'renews' ? (
          <>
            <dt className="text-muted-foreground">Renews on</dt>
            <dd>{formatDay(customer.renews_on)}</dd>
          </>
        ) : null}
        {customer.won_at ? (
          <>
            <dt className="text-muted-foreground">Won</dt>
            <dd>{formatDate(customer.won_at)}</dd>
          </>
        ) : null}
        {date === 'none' ? (
          <>
            <dt className="text-muted-foreground">Reason</dt>
            <dd>{customer.outcome_reason ?? '—'}</dd>
          </>
        ) : null}
      </dl>
    )
  }

  const date = dateFor(values.stage)

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pipeline-stage">Stage</FieldLabel>
          <NativeSelect
            id="pipeline-stage"
            value={values.stage}
            onChange={(event) => set('stage', event.target.value as Customer['stage'])}
            className="w-full"
          >
            {CUSTOMER_STAGES.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {CUSTOMER_STAGE_LABELS[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            {CUSTOMER_STAGE_LABELS[customer.stage]} since {formatDate(customer.stage_changed_at)}
            {customer.won_at ? `; won ${formatDate(customer.won_at)}` : ''}.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="pipeline-owner">Owner</FieldLabel>
          <NativeSelect
            id="pipeline-owner"
            value={values.ownerId}
            onChange={(event) => set('ownerId', event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">Unassigned</NativeSelectOption>
            {staff.map((member) => (
              <NativeSelectOption key={member.user_id} value={member.user_id}>
                {personName(member.profile)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="pipeline-source">Source</FieldLabel>
          <Input
            id="pipeline-source"
            type="text"
            value={values.source}
            onChange={(event) => set('source', event.target.value)}
            placeholder="Website, referral, event…"
            maxLength={100}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pipeline-plan">Plan</FieldLabel>
            <Input
              id="pipeline-plan"
              type="text"
              value={values.plan}
              onChange={(event) => set('plan', event.target.value)}
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pipeline-value">Annual value ({siteConfig.currency})</FieldLabel>
            <Input
              id="pipeline-value"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={values.annualValue}
              onChange={(event) => set('annualValue', event.target.value)}
            />
          </Field>
        </div>
        {date === 'close' ? (
          <Field>
            <FieldLabel htmlFor="pipeline-close">Expected close</FieldLabel>
            <Input
              id="pipeline-close"
              type="date"
              value={values.expectedClose}
              onChange={(event) => set('expectedClose', event.target.value)}
              className="w-auto"
            />
          </Field>
        ) : null}
        {date === 'renews' ? (
          <Field>
            <FieldLabel htmlFor="pipeline-renews">Renews on</FieldLabel>
            <Input
              id="pipeline-renews"
              type="date"
              value={values.renewsOn}
              onChange={(event) => set('renewsOn', event.target.value)}
              className="w-auto"
            />
          </Field>
        ) : null}
        {date === 'none' ? (
          <Field>
            <FieldLabel htmlFor="pipeline-reason">Reason</FieldLabel>
            <Input
              id="pipeline-reason"
              type="text"
              value={values.outcomeReason}
              onChange={(event) => set('outcomeReason', event.target.value)}
              placeholder="Why it was lost, or why they left"
              maxLength={500}
            />
          </Field>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field orientation="horizontal">
          <Button type="submit" disabled={busy !== null || !isDirty}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved && !isDirty ? (
            <span className="text-sm text-muted-foreground" role="status">
              Saved.
            </span>
          ) : null}
        </Field>
      </FieldGroup>
    </form>
  )
}
