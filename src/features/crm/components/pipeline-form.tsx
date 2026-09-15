import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { StageBadge } from '@/features/crm/components/stage-badge'
import { useCrmAction } from '@/features/crm/hooks/use-crm-action'
import { CUSTOMER_STAGE_LABELS } from '@/features/crm/stages'
import { personName } from '@/lib/auth/display-user'
import { CUSTOMER_STAGES, updateCustomer, type Customer } from '@/lib/supabase/crm'
import type { PlatformMember } from '@/lib/supabase/platform'

type PipelineFormProps = {
  customer: Customer
  staff: PlatformMember[]
  /** Whether the viewer may change stage, owner and source (superadmin, admin). */
  canManage: boolean
}

/**
 * Where the customer sits in the pipeline and who looks after it. Read-only for support;
 * a form for the tiers that move the pipeline. Nothing else on the page writes these fields,
 * so the form keeps its own state and the record catches up on the next load.
 */
export const PipelineForm = ({ customer, staff, canManage }: PipelineFormProps) => {
  const { busy, error, run } = useCrmAction()
  const [stage, setStage] = useState(customer.stage)
  const [ownerId, setOwnerId] = useState(customer.owner_id ?? '')
  const [source, setSource] = useState(customer.source ?? '')
  // What was last saved, so "dirty" means "differs from the database".
  const [baseline, setBaseline] = useState({
    stage: customer.stage,
    ownerId: customer.owner_id ?? '',
    source: customer.source ?? '',
  })
  const [saved, setSaved] = useState(false)

  const isDirty =
    stage !== baseline.stage || ownerId !== baseline.ownerId || source.trim() !== baseline.source

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty) return
    setSaved(false)
    const ok = await run('pipeline', () =>
      updateCustomer(customer.org_id, { stage, owner_id: ownerId || null, source }),
    )
    if (ok) {
      setBaseline({ stage, ownerId, source: source.trim() })
      setSaved(true)
    }
  }

  if (!canManage) {
    return (
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Stage</dt>
        <dd>
          <StageBadge stage={customer.stage} />
        </dd>
        <dt className="text-muted-foreground">Owner</dt>
        <dd>{customer.owner ? personName(customer.owner) : 'Unassigned'}</dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd>{customer.source ?? '—'}</dd>
      </dl>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pipeline-stage">Stage</FieldLabel>
          <NativeSelect
            id="pipeline-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as Customer['stage'])}
            className="w-full"
          >
            {CUSTOMER_STAGES.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {CUSTOMER_STAGE_LABELS[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="pipeline-owner">Owner</FieldLabel>
          <NativeSelect
            id="pipeline-owner"
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
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
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Website, referral, event…"
            maxLength={100}
          />
        </Field>
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
