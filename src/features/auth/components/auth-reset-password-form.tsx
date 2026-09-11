import type { FormEventHandler } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type AuthResetPasswordFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  email: string
  password: string
  confirmPassword: string
  loading: boolean
  onPasswordChange: (password: string) => void
  onConfirmPasswordChange: (confirmPassword: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function AuthResetPasswordForm({
  className,
  email,
  password,
  confirmPassword,
  loading,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  ...props
}: AuthResetPasswordFormProps) {
  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {email ? (
              <>
                for <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              'Choose a new password for your account'
            )}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            id="new-password"
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
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
