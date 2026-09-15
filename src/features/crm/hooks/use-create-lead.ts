import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { describeCreateError } from '@/features/organisations/hooks/use-create-organisation'
import { createLead } from '@/lib/supabase/crm'
import { normaliseSlugInput, slugify } from '@/lib/supabase/organisations'

/**
 * Staff's "new organisation" form. The organisation starts as a lead owned by the caller; on
 * success we open its customer record.
 */
export const useCreateLead = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const [name, setNameValue] = useState('')
  const [slug, setSlugValue] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [source, setSource] = useState('')
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    setError(null)
    setLoading(true)

    try {
      const organisation = await createLead({ name, slug: slugify(slug), source })
      await router.invalidate()
      await navigate({ to: '/staff/organisations/$orgId', params: { orgId: organisation.id } })
    } catch (createError) {
      setError(describeCreateError(createError))
    } finally {
      setLoading(false)
    }
  }

  return { name, slug, source, loading, error, setName, setSlug, setSource, handleSubmit }
}
