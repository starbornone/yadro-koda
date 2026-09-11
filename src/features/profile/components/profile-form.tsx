import type { FormEventHandler } from 'react'
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
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

type ProfileFormProps = {
  displayName: string
  phone: string
  isDirty: boolean
  isSaving: boolean
  error: string | null
  message: string | null
  onDisplayNameChange: (displayName: string) => void
  onPhoneChange: (phone: string) => void
  onSave: FormEventHandler<HTMLFormElement>
}

export function ProfileForm({
  displayName,
  phone,
  isDirty,
  isSaving,
  error,
  message,
  onDisplayNameChange,
  onPhoneChange,
  onSave,
}: ProfileFormProps) {
  return (
    <form onSubmit={onSave}>
      <FieldSet>
        <FieldLegend>Profile</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-display-name">Display name</FieldLabel>
            <Input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              autoComplete="name"
              maxLength={100}
              required
            />
            <FieldDescription>How you appear across the app.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-phone">Phone</FieldLabel>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              autoComplete="tel"
              maxLength={32}
            />
            <FieldDescription>Optional.</FieldDescription>
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

          <Field orientation="horizontal">
            <Button type="submit" disabled={isSaving || !isDirty}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
