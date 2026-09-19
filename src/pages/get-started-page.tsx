import { Link } from '@tanstack/react-router'
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CUSTOMER_FIELDS } from '@/config/customer-fields'
import { DetailsFields } from '@/features/crm/components/details-fields'
import { homeContent } from '@/features/marketing/content'
import { useEnquiry } from '@/features/marketing/hooks/use-enquiry'

/**
 * The website's door into the pipeline: a visitor says who they are and what they need, and
 * staff find them as a lead. No account is involved; that comes with the proposal.
 */
export const GetStartedPage = () => {
  const { getStarted } = homeContent
  const form = useEnquiry()

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-16 md:px-6 md:py-24">
      {form.sent ? (
        <div className="flex flex-col items-center gap-4 text-center" role="status">
          <CircleCheckIcon className="size-8 text-primary" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">{getStarted.thanks.heading}</h1>
          <p className="text-muted-foreground">
            {getStarted.thanks.body} <strong>{form.email.trim()}</strong>.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to the home page</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">{getStarted.heading}</h1>
            <p className="text-muted-foreground">{getStarted.subhead}</p>
          </div>
          <form onSubmit={form.handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="enquiry-organisation">Organisation</FieldLabel>
                <Input
                  id="enquiry-organisation"
                  type="text"
                  value={form.organisation}
                  onChange={(event) => form.setOrganisation(event.target.value)}
                  autoComplete="organization"
                  maxLength={100}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="enquiry-name">Your name</FieldLabel>
                <Input
                  id="enquiry-name"
                  type="text"
                  value={form.contactName}
                  onChange={(event) => form.setContactName(event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="enquiry-email">Email</FieldLabel>
                <Input
                  id="enquiry-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => form.setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                />
                <FieldDescription>Where we reply.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="enquiry-phone">Phone</FieldLabel>
                <Input
                  id="enquiry-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => form.setPhone(event.target.value)}
                  autoComplete="tel"
                  maxLength={30}
                />
                <FieldDescription>Optional.</FieldDescription>
              </Field>

              <DetailsFields
                fields={CUSTOMER_FIELDS}
                values={form.details}
                errors={form.detailErrors}
                onChange={form.setDetail}
                idPrefix="enquiry"
                disabled={form.loading}
              />

              <Field>
                <FieldLabel htmlFor="enquiry-message">Anything else?</FieldLabel>
                <Textarea
                  id="enquiry-message"
                  value={form.message}
                  onChange={(event) => form.setMessage(event.target.value)}
                  rows={4}
                  maxLength={5000}
                />
              </Field>

              {/* The honeypot: off-screen and out of the tab order. People never fill it in. */}
              <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="enquiry-website">Website</label>
                <input
                  id="enquiry-website"
                  type="text"
                  name="website_url"
                  value={form.websiteUrl}
                  onChange={(event) => form.setWebsiteUrl(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {form.error ? (
                <Alert variant="destructive">
                  <CircleAlertIcon className="size-4" />
                  <AlertDescription>{form.error}</AlertDescription>
                </Alert>
              ) : null}

              <Field orientation="horizontal">
                <Button type="submit" size="lg" disabled={form.loading}>
                  {form.loading ? 'Sending…' : getStarted.submit}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </>
      )}
    </section>
  )
}
