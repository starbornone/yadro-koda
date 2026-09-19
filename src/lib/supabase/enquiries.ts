import type { CustomerDetails } from './crm'
import { supabase } from './supabase'

/**
 * The website's door into the CRM. A visitor tells us who they are and what they need; the
 * database enters their organisation as a lead with them as its contact. Nothing comes back
 * but success — the database keeps its guards (honeypot, one a day per address, a rate limit
 * per IP) to itself, and this module keeps out of the marketing chunk's way by importing no
 * more than the client.
 */

export type EnquiryInput = {
  organisation: string
  contactName: string
  email: string
  phone?: string
  message?: string
  details?: CustomerDetails
  /** The field people never see. Anything in it and the enquiry is quietly dropped. */
  websiteUrl?: string
}

const blankToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const submitEnquiry = async (input: EnquiryInput): Promise<void> => {
  const { error } = await supabase.rpc('submit_enquiry', {
    organisation: input.organisation.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    // Omitted parameters take the RPC's defaults.
    phone: blankToUndefined(input.phone),
    message: blankToUndefined(input.message),
    details: input.details,
    website_url: blankToUndefined(input.websiteUrl),
  })

  if (error) {
    throw error
  }
}

/** What to tell the person when the database said no. */
export const describeEnquiryError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (/too many enquiries/.test(message)) {
    return 'Too many enquiries from your connection just now. Please try again in an hour.'
  }
  if (/email address is not valid/.test(message)) {
    return 'That email address does not look right.'
  }
  return message || 'Could not send your enquiry.'
}
