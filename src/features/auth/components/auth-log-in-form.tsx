import type { FormEventHandler } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type AuthLogInFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  email: string
  password: string
  loading: boolean
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onSignIn: FormEventHandler<HTMLFormElement>
  onShowSignUp: () => void
}

export function AuthLogInForm({
  className,
  email,
  password,
  loading,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onShowSignUp,
  ...props
}: AuthLogInFormProps) {
  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSignIn} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
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
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a href="#" className="ml-auto text-sm underline-offset-4 hover:underline">
              Forgot your password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            minLength={6}
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? 'Working...' : 'Login'}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{' '}
            <a
              href="#"
              className="underline underline-offset-4"
              onClick={(event) => {
                event.preventDefault()
                onShowSignUp()
              }}
            >
              Sign up
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
