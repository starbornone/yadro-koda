import { Link, getRouteApi } from '@tanstack/react-router'
import { CircleCheckIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AuthFeedback } from '@/features/auth/components/auth-feedback'
import { AuthForgotPasswordForm } from '@/features/auth/components/auth-forgot-password-form'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { AuthResetPasswordForm } from '@/features/auth/components/auth-reset-password-form'
import { useForgotPassword } from '@/features/auth/hooks/use-forgot-password'
import { useResetPasswordPage } from '@/features/auth/hooks/use-reset-password-page'

const resetPasswordRoute = getRouteApi('/reset-password')

/** The link was bad, so there is no session; let the user ask for a fresh one right here. */
const ExpiredLink = ({ reason }: { reason: string }) => {
  const forgot = useForgotPassword()

  return (
    <>
      <AuthLayout>
        <AuthForgotPasswordForm
          title="Link expired"
          description={`${reason} Enter your email and we'll send a new one.`}
          email={forgot.email}
          loading={forgot.loading}
          onEmailChange={forgot.setEmail}
          onSubmit={forgot.handleSubmit}
        />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline underline-offset-4">
            Back to login
          </Link>
        </p>
      </AuthLayout>
      <AuthFeedback error={forgot.error} message={forgot.message} />
    </>
  )
}

const SetNewPassword = () => {
  const {
    email,
    password,
    confirmPassword,
    loading,
    error,
    isDone,
    setPassword,
    setConfirmPassword,
    handleReset,
  } = useResetPasswordPage()

  if (isDone) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6">
          <Alert>
            <CircleCheckIcon className="size-4" />
            <AlertTitle>Password updated</AlertTitle>
            <AlertDescription>You&apos;re signed in with your new password.</AlertDescription>
          </Alert>
          <Button asChild>
            <Link to="/app">Continue to dashboard</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <>
      <AuthLayout>
        <AuthResetPasswordForm
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          loading={loading}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleReset}
        />
      </AuthLayout>
      <AuthFeedback error={error} message={null} />
    </>
  )
}

export const ResetPasswordPage = () => {
  const { linkError } = resetPasswordRoute.useRouteContext()

  return linkError ? <ExpiredLink reason={linkError} /> : <SetNewPassword />
}
