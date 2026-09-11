import { AuthFeedback } from '@/features/auth/components/auth-feedback'
import { AuthForgotPasswordForm } from '@/features/auth/components/auth-forgot-password-form'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { AuthLogInForm } from '@/features/auth/components/auth-log-in-form'
import { AuthSignUpForm } from '@/features/auth/components/auth-sign-up-form'
import { useAuthPage } from '@/features/auth/hooks/use-auth-page'

export const AuthPage = () => {
  const {
    authView,
    loading,
    error,
    message,
    formState,
    setDisplayName,
    setEmail,
    setPassword,
    handleSignIn,
    handleSignUp,
    handleForgotPassword,
    showLogIn,
    showSignUp,
    showForgotPassword,
  } = useAuthPage()

  return (
    <>
      <AuthLayout>
        {authView === 'login' ? (
          <AuthLogInForm
            email={formState.email}
            password={formState.password}
            loading={loading}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSignIn={handleSignIn}
            onShowSignUp={showSignUp}
            onShowForgotPassword={showForgotPassword}
          />
        ) : authView === 'sign-up' ? (
          <AuthSignUpForm
            displayName={formState.displayName}
            email={formState.email}
            password={formState.password}
            loading={loading}
            onDisplayNameChange={setDisplayName}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSignUp={handleSignUp}
            onShowLogIn={showLogIn}
          />
        ) : (
          <AuthForgotPasswordForm
            email={formState.email}
            loading={loading}
            onEmailChange={setEmail}
            onSubmit={handleForgotPassword}
            onShowLogIn={showLogIn}
          />
        )}
      </AuthLayout>

      <AuthFeedback error={error} message={message} />
    </>
  )
}
