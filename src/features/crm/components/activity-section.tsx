import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlertIcon, Trash2Icon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useRouteAction } from '@/hooks/use-route-action'
import { ActivityEntry } from '@/features/crm/components/activity-entry'
import { ACTIVITY_KIND_LABELS, LOGGABLE_ACTIVITY_KINDS } from '@/features/crm/stages'
import {
  addActivity,
  removeActivity,
  type Activity,
  type ActivityInput,
  type Contact,
} from '@/lib/supabase/crm'

type ActivitySectionProps = {
  orgId: string
  activities: Activity[]
  contacts: Contact[]
  currentUserId: string
  /** Whether the viewer may log activity (every staff tier). */
  canLog: boolean
  /** Whether the viewer may remove anyone's entry (superadmin, admin). */
  canManage: boolean
}

/** The customer timeline: what staff logged, plus what the database recorded — stage changes and joins. */
export const ActivitySection = ({
  orgId,
  activities,
  contacts,
  currentUserId,
  canLog,
  canManage,
}: ActivitySectionProps) => {
  const { busy, error, run } = useRouteAction()
  const [kind, setKind] = useState<ActivityInput['kind']>('note')
  const [contactId, setContactId] = useState('')
  const [body, setBody] = useState('')

  const contactName = (id: string | null) => contacts.find((contact) => contact.id === id)?.name

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!body.trim()) return
    const ok = await run('log', () =>
      addActivity(orgId, { kind, body, contact_id: contactId || null }),
    )
    if (ok) setBody('')
  }

  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
      <h2 id="activity-heading" className="text-base font-medium">
        Activity
      </h2>

      {canLog ? (
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="activity-kind">Type</FieldLabel>
                <NativeSelect
                  id="activity-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as ActivityInput['kind'])}
                  className="w-full"
                >
                  {LOGGABLE_ACTIVITY_KINDS.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {ACTIVITY_KIND_LABELS[option]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="activity-contact">With</FieldLabel>
                <NativeSelect
                  id="activity-contact"
                  value={contactId}
                  onChange={(event) => setContactId(event.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="">Nobody in particular</NativeSelectOption>
                  {contacts.map((contact) => (
                    <NativeSelectOption key={contact.id} value={contact.id}>
                      {contact.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="activity-body">What happened</FieldLabel>
              <Textarea
                id="activity-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                maxLength={5000}
                required
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Field orientation="horizontal">
              <Button type="submit" size="sm" disabled={busy !== null || !body.trim()}>
                {busy === 'log' ? 'Logging…' : 'Log activity'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : null}

      {activities.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      ) : (
        <ol className="flex flex-col divide-y rounded-xl border">
          {activities.map((activity) => {
            // A join is linked to the joiner's own contact; "Joined with Rex" would misread.
            const withContact =
              activity.kind === 'joined' ? undefined : contactName(activity.contact_id)
            const canRemove = canManage || activity.created_by === currentUserId
            return (
              <ActivityEntry key={activity.id} activity={activity} withContact={withContact}>
                {canRemove ? (
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy !== null}
                    aria-label="Delete entry"
                    title="Delete this entry?"
                    actionLabel="Delete"
                    onConfirm={() => void run(activity.id, () => removeActivity(activity.id))}
                  >
                    <Trash2Icon />
                  </ConfirmButton>
                ) : null}
              </ActivityEntry>
            )
          })}
        </ol>
      )}
    </section>
  )
}
