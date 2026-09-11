import { LogOutIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AccountDetails } from '@/features/profile/components/account-details'
import { ChangePasswordForm } from '@/features/profile/components/change-password-form'
import { ProfileForm } from '@/features/profile/components/profile-form'
import { useProfilePage } from '@/features/profile/hooks/use-profile-page'

export const ProfilePage = () => {
  const {
    user,
    profile,
    form,
    isDirty,
    isSaving,
    error,
    message,
    setDisplayName,
    setPhone,
    handleSave,
    passwordForm,
    signOut,
    isSigningOut,
    signOutError,
  } = useProfilePage()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Profile' }]} />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
          <ProfileForm
            displayName={form.displayName}
            phone={form.phone}
            isDirty={isDirty}
            isSaving={isSaving}
            error={error}
            message={message}
            onDisplayNameChange={setDisplayName}
            onPhoneChange={setPhone}
            onSave={handleSave}
          />

          <Separator />

          <ChangePasswordForm
            password={passwordForm.password}
            confirmPassword={passwordForm.confirmPassword}
            loading={passwordForm.loading}
            error={passwordForm.error}
            isDone={passwordForm.isDone}
            onPasswordChange={passwordForm.setPassword}
            onConfirmPasswordChange={passwordForm.setConfirmPassword}
            onSubmit={passwordForm.handleSubmit}
          />

          <Separator />

          <AccountDetails user={user} profile={profile} />

          <Separator />

          <section aria-labelledby="session-heading" className="flex flex-col gap-3">
            <h2 id="session-heading" className="text-base font-medium">
              Session
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => void signOut()} disabled={isSigningOut}>
                <LogOutIcon />
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </Button>
              {signOutError ? <p className="text-sm text-destructive">{signOutError}</p> : null}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
