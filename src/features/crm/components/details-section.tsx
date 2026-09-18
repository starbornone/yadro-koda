import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { CUSTOMER_FIELDS } from '@/config/customer-fields'
import { DetailsFields } from '@/features/crm/components/details-fields'
import {
  detailsFrom,
  displayValue,
  formValuesFrom,
  type CustomerField,
  type FieldErrors,
  type FieldFormValues,
} from '@/features/crm/fields'
import { useRouteAction } from '@/hooks/use-route-action'
import { updateCustomer, type Customer } from '@/lib/supabase/crm'

type DetailsSectionProps = {
  customer: Customer
  /** Whether the viewer may edit (superadmin, admin). Everyone on staff reads. */
  canManage: boolean
  /** The product's fields; defaults to the configured list. */
  fields?: readonly CustomerField[]
}

/**
 * What the product records about the customer beyond the pipeline, as the product's fields.
 * Read-only for support; a form for the tiers that manage customers. Renders nothing when the
 * product has no fields. Like the pipeline form, it keeps its own state and the record catches
 * up on the next load.
 */
export const DetailsSection = ({
  customer,
  canManage,
  fields = CUSTOMER_FIELDS,
}: DetailsSectionProps) => {
  const { busy, error, run } = useRouteAction()
  const [values, setValues] = useState<FieldFormValues>(() =>
    formValuesFrom(fields, customer.details),
  )
  const [baseline, setBaseline] = useState(values)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saved, setSaved] = useState(false)

  if (fields.length === 0) return null

  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline)

  const setValue = (key: string, value: FieldFormValues[string]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)))
    setSaved(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty) return

    const next = detailsFrom(fields, values, customer.details)
    setErrors(next.errors)
    if (Object.keys(next.errors).length > 0) return

    const ok = await run('details', () =>
      updateCustomer(customer.org_id, { details: next.details }),
    )
    if (ok) {
      setBaseline(values)
      setSaved(true)
    }
  }

  return (
    <section aria-labelledby="details-heading" className="flex flex-col gap-3">
      <h2 id="details-heading" className="text-base font-medium">
        Details
      </h2>
      {canManage ? (
        <form onSubmit={handleSubmit} className="max-w-md">
          <FieldGroup>
            <DetailsFields
              fields={fields}
              values={values}
              errors={errors}
              onChange={setValue}
              idPrefix="details"
              disabled={busy !== null}
            />
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
      ) : (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
          {fields.map((field) => (
            <div key={field.key} className="contents">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd>{displayValue(field, customer.details)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
