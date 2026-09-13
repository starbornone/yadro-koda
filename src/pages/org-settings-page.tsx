import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useOrgSettingsPage } from '@/features/organisations/hooks/use-org-settings-page'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'

export const OrgSettingsPage = () => {
  const { org, role, canEdit, name, setName, isDirty, isSaving, error, message, handleSave } =
    useOrgSettingsPage()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Settings' }]} />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
          <form onSubmit={handleSave}>
            <FieldSet>
              <FieldLegend>General</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="org-settings-name">Organisation name</FieldLabel>
                  <Input
                    id="org-settings-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    required
                    readOnly={!canEdit}
                    aria-readonly={!canEdit}
                  />
                  {canEdit ? null : (
                    <FieldDescription>
                      Only owners and admins can change this. Your role is {ORG_ROLE_LABELS[role]}.
                    </FieldDescription>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="org-settings-slug">URL name</FieldLabel>
                  <Input id="org-settings-slug" type="text" value={org.slug} readOnly />
                  <FieldDescription>Fixed when the organisation was created.</FieldDescription>
                </Field>

                {error ? (
                  <Alert variant="destructive">
                    <CircleAlertIcon className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                {message ? (
                  <Alert>
                    <CircleCheckIcon className="size-4" />
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ) : null}

                {canEdit ? (
                  <Field orientation="horizontal">
                    <Button type="submit" disabled={isSaving || !isDirty}>
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </Field>
                ) : null}
              </FieldGroup>
            </FieldSet>
          </form>
        </div>
      </div>
    </>
  )
}
