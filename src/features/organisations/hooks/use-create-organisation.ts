import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { createOrganisation, slugify } from '@/lib/supabase/organisations'

/**
 * Create-organisation form state. On success the new organisation is already active (the RPC
 * sets it), so we refresh the loaders and go to the dashboard.
 */
export const useCreateOrganisation = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const [name, setNameValue] = useState('')
  const [slug, setSlugValue] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setName = (value: string) => {
    setNameValue(value)
    if (!slugEdited) setSlugValue(slugify(value))
  }

  // Light normalisation while typing: a trailing hyphen must survive so "acme-" can become
  // "acme-co". Full `slugify` runs on submit.
  const setSlug = (value: string) => {
    setSlugEdited(true)
    setSlugValue(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-/, '')
        .slice(0, 50),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    setError(null)
    setLoading(true)

    try {
      await createOrganisation({ name, slug: slugify(slug) })
      await router.invalidate()
      await navigate({ to: '/app' })
    } catch (createError) {
      setError(describeError(createError))
    } finally {
      setLoading(false)
    }
  }

  return { name, slug, loading, error, setName, setSlug, handleSubmit }
}

const describeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (/organisations_slug_key|duplicate key/.test(message)) {
    return 'That URL name is already taken. Choose another.'
  }
  if (/organisations_slug_check/.test(message)) {
    return 'URL names use lowercase letters, numbers and single hyphens, 2–50 characters.'
  }
  return message || 'Failed to create the organisation.'
}
