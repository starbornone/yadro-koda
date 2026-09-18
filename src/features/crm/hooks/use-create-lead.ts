import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { CUSTOMER_FIELDS } from '@/config/customer-fields'
import {
  detailsFrom,
  formValuesFrom,
  type FieldErrors,
  type FieldFormValues,
} from '@/features/crm/fields'
import { describeCreateError } from '@/features/organisations/hooks/use-create-organisation'
import { createLead } from '@/lib/supabase/crm'
import { normaliseSlugInput, slugify } from '@/lib/supabase/organisations'

/**
 * Staff's "new organisation" form. The organisation starts as a lead owned by the caller,
 * with whatever of the product's fields were filled in; on success we open its customer record.
 */
export const useCreateLead = (fields = CUSTOMER_FIELDS) => {
  const router = useRouter()
  const navigate = useNavigate()
  const [name, setNameValue] = useState('')
  const [slug, setSlugValue] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [source, setSource] = useState('')
  const [details, setDetails] = useState<FieldFormValues>(() => formValuesFrom(fields, {}))
  const [detailErrors, setDetailErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setName = (value: string) => {
    setNameValue(value)
    if (!slugEdited) setSlugValue(slugify(value))
  }

  const setSlug = (value: string) => {
    setSlugEdited(true)
    setSlugValue(normaliseSlugInput(value))
  }

  const setDetail = (key: string, value: FieldFormValues[string]) => {
    setDetails((current) => ({ ...current, [key]: value }))
    setDetailErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const converted = detailsFrom(fields, details)
    setDetailErrors(converted.errors)
    if (Object.keys(converted.errors).length > 0) return

    setError(null)
    setLoading(true)

    try {
      const organisation = await createLead({
        name,
        slug: slugify(slug),
        source,
        details: converted.details,
      })
      await router.invalidate()
      await navigate({ to: '/staff/organisations/$orgId', params: { orgId: organisation.id } })
    } catch (createError) {
      setError(describeCreateError(createError))
    } finally {
      setLoading(false)
    }
  }

  return {
    name,
    slug,
    source,
    details,
    detailErrors,
    loading,
    error,
    setName,
    setSlug,
    setSource,
    setDetail,
    handleSubmit,
  }
}
