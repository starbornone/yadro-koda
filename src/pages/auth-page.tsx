import { AuthFeedback } from '@/features/auth/components/auth-feedback'
import { AuthForm } from '@/features/auth/components/auth-form'
import { GalleryVerticalEnd } from 'lucide-react'
import { ProfileSummaryCard } from '@/features/auth/components/profile-summary-card'
import { useAuthPage } from '@/features/auth/hooks/use-auth-page'

export const AuthPage = () => {
  const {
    user,
    profile,
    loading,
    error,
    message,
    formState,
    setDisplayName,
    setEmail,
    setPassword,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  } = useAuthPage()

  return (
    <>
      {user ? (
        <ProfileSummaryCard
          user={user}
          profile={profile}
          loading={loading}
          onSignOut={handleSignOut}
        />
      ) : (
        <div className="grid min-h-svh lg:grid-cols-2">
          <div className="flex flex-col gap-4 p-6 md:p-10">
            <div className="flex justify-center gap-2 md:justify-start">
              <a href="#" className="flex items-center gap-2 font-medium">
                <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                Јадро Кода
              </a>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-xs">
                <AuthForm
                  displayName={formState.displayName}
                  email={formState.email}
                  password={formState.password}
                  loading={loading}
                  onDisplayNameChange={setDisplayName}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSignIn={handleSignIn}
                  onSignUp={handleSignUp}
                />
              </div>
            </div>
          </div>
          <div className="relative hidden bg-muted lg:block">
            <img
              src="https://images.unsplash.com/photo-1557515126-1bf9ada5cb93"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </div>
      )}

      <AuthFeedback error={error} message={message} />
    </>
  )
}
