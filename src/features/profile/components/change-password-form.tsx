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

type ChangePasswordFormProps = {
  password: string
  confirmPassword: string
  loading: boolean
  error: string | null
  isDone: boolean
  onPasswordChange: (password: string) => void
  onConfirmPasswordChange: (confirmPassword: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function ChangePasswordForm({
  password,
  confirmPassword,
  loading,
  error,
  isDone,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: ChangePasswordFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <FieldSet>
        <FieldLegend>Password</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="change-password-new">New password</FieldLabel>
            <Input
              id="change-password-new"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <FieldDescription>Must be at least 6 characters long.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="change-password-confirm">Confirm new password</FieldLabel>
            <Input
              id="change-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </Field>

          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {isDone ? (
            <Alert>
              <CircleCheckIcon className="size-4" />
              <AlertDescription>Password updated.</AlertDescription>
            </Alert>
          ) : null}

          <Field orientation="horizontal">
            <Button type="submit" disabled={loading || !password || !confirmPassword}>
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
