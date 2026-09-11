import type { FormEventHandler } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type AuthForgotPasswordFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  title?: string
  description?: string
  email: string
  loading: boolean
  onEmailChange: (email: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  /** When provided, renders a "Back to login" link that calls it. */
  onShowLogIn?: () => void
}

export function AuthForgotPasswordForm({
  className,
  title = 'Reset your password',
  description = "Enter your email and we'll send you a link to set a new password",
  email,
  loading,
  onEmailChange,
  onSubmit,
  onShowLogIn,
  ...props
}: AuthForgotPasswordFormProps) {
  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-balance text-muted-foreground">{description}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            autoComplete="email"
            placeholder="m@example.com"
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </Field>
        {onShowLogIn ? (
          <Field>
            <FieldDescription className="text-center">
              Remembered it?{' '}
              <a
                href="#"
                className="underline underline-offset-4"
                onClick={(event) => {
                  event.preventDefault()
                  onShowLogIn()
                }}
              >
                Back to login
              </a>
            </FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>
    </form>
  )
}
