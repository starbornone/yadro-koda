import { CircleAlertIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useCreateLead } from '@/features/crm/hooks/use-create-lead'

/** Staff enter an organisation that has no users yet. It starts in the pipeline as a lead. */
export const StaffNewOrganisationPage = () => {
  const { name, slug, source, loading, error, setName, setSlug, setSource, handleSubmit } =
    useCreateLead()

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Staff', to: '/staff' },
          { label: 'Organisations', to: '/staff/organisations' },
          { label: 'New' },
        ]}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New organisation</h1>
          <p className="text-muted-foreground">
            Enters the pipeline as a lead, owned by you. Its people join later by invitation.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="max-w-md">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="lead-name">Organisation name</FieldLabel>
              <Input
                id="lead-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="organization"
                maxLength={100}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-slug">URL name</FieldLabel>
              <Input
                id="lead-slug"
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                minLength={2}
                maxLength={50}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
              />
              <FieldDescription>
                Lowercase letters, numbers and hyphens. Used in links; can&apos;t be changed later.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-source">Source</FieldLabel>
              <Input
                id="lead-source"
                type="text"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Website, referral, event…"
                maxLength={100}
              />
              <FieldDescription>Where this lead came from. Optional.</FieldDescription>
            </Field>

            {error ? (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field orientation="horizontal">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating…' : 'Create lead'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </>
  )
}
