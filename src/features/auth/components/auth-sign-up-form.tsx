import type { FormEventHandler } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type AuthSignUpFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  displayName: string
  email: string
  password: string
  loading: boolean
  onDisplayNameChange: (displayName: string) => void
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onSignUp: FormEventHandler<HTMLFormElement>
  onShowLogIn: () => void
}

export function AuthSignUpForm({
  className,
  displayName,
  email,
  password,
  loading,
  onDisplayNameChange,
  onEmailChange,
  onPasswordChange,
  onSignUp,
  onShowLogIn,
  ...props
}: AuthSignUpFormProps) {
  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSignUp} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Fill in the form below to create your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />
        </Field>
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
          <FieldDescription>
            We&apos;ll use this to contact you. We will not share your email with anyone else.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Working...' : 'Create Account'}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="px-6 text-center">
            Already have an account?{' '}
            <a
              href="#"
              className="underline underline-offset-4"
              onClick={(event) => {
                event.preventDefault()
                onShowLogIn()
              }}
            >
              Sign in
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
