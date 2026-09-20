import { useState } from 'react'
import type { FormEvent } from 'react'
import { CUSTOMER_FIELDS } from '@/config/customer-fields'
import {
  detailsFrom,
  formValuesFrom,
  type FieldErrors,
  type FieldFormValues,
} from '@/features/crm/fields'
import { describeEnquiryError, submitEnquiry } from '@/lib/supabase/enquiries'

/**
 * The "get started" form: who the visitor is, the product's fields, and a message. On
 * success the page thanks them; the lead is now staff's to follow up. The form also carries
 * a field people never see — a bot that fills it in gets the same thanks and no lead.
 */
export const useEnquiry = (fields = CUSTOMER_FIELDS) => {
  const [organisation, setOrganisation] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [details, setDetails] = useState<FieldFormValues>(() => formValuesFrom(fields, {}))
  const [detailErrors, setDetailErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

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
      await submitEnquiry({
        organisation,
        contactName,
        email,
        phone,
        message,
        details: converted.details,
        websiteUrl,
      })
      setSent(true)
    } catch (submitError) {
      setError(describeEnquiryError(submitError))
    } finally {
      setLoading(false)
    }
  }

  return {
    organisation,
    contactName,
    email,
    phone,
    message,
    websiteUrl,
    details,
    detailErrors,
    loading,
    error,
    sent,
    setOrganisation,
    setContactName,
    setEmail,
    setPhone,
    setMessage,
    setWebsiteUrl,
    setDetail,
    handleSubmit,
  }
}
