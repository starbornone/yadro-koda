import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { useInvitePage } from '@/features/organisations/hooks/use-invite-page'
import { ORG_ROLE_LABELS, PLATFORM_ROLE_LABELS } from '@/lib/auth/permissions'
import type { InvitationPreview } from '@/lib/supabase/invitations'

const Screen = ({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions: ReactNode
}) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-balance text-muted-foreground">{children}</p>
    </div>
    <div className="flex flex-col gap-3">{actions}</div>
  </div>
)

const HomeLink = () => (
  <Button asChild variant="outline">
    <Link to="/">Go to the home page</Link>
  </Button>
)

/** What the link joins, and as what — worded to follow "invited you to join …". */
const describe = (invitation: InvitationPreview) =>
  invitation.kind === 'platform'
    ? { target: 'the staff team', role: PLATFORM_ROLE_LABELS[invitation.role].toLowerCase() }
    : { target: invitation.organisation_name, role: ORG_ROLE_LABELS[invitation.role].toLowerCase() }

/** Where an invitation link lands. One screen per state; `useInvitePage` picks which. */
export const InvitePage = () => {
  const {
    token,
    invitation,
    view,
    currentEmail,
    isAccepting,
    accept,
    signOut,
    isSigningOut,
    error,
  } = useInvitePage()

  const inviter = invitation?.invited_by_name ?? 'Someone'
  const { target, role } = invitation ? describe(invitation) : { target: '', role: '' }

  return (
    <AuthLayout>
      {!invitation || view === 'not-found' ? (
        <Screen title="This invitation link isn't valid" actions={<HomeLink />}>
          It may have been revoked, or the link was copied incompletely. Ask whoever invited you for
          a new one.
        </Screen>
      ) : view === 'expired' ? (
        <Screen title="This invitation has expired" actions={<HomeLink />}>
          {inviter} invited you to join {target}, but links only last 7 days. Ask them for a new
          one.
        </Screen>
      ) : view === 'accepted' ? (
        <Screen
          title="This invitation has already been used"
          actions={
            <Button asChild>
              <Link to="/accounts">Continue to the app</Link>
            </Button>
          }
        >
          If that was you, you already belong to {target}. Otherwise, ask whoever invited you for a
          new link.
        </Screen>
      ) : view === 'signed-out' ? (
        <Screen
          title={`Join ${target}`}
          actions={
            <>
              <Button asChild>
                <Link to="/signup" search={{ redirect: `/invite/${token}` }}>
                  Create an account
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login" search={{ redirect: `/invite/${token}` }}>
                  I already have one
                </Link>
              </Button>
            </>
          }
        >
          {inviter} invited you to join {target} as {role}. Sign in with{' '}
          <strong>{invitation.email}</strong> to accept.
        </Screen>
      ) : view === 'wrong-account' ? (
        <Screen
          title="This invitation is for a different account"
          actions={
            <Button variant="outline" onClick={() => void signOut()} disabled={isSigningOut}>
              {isSigningOut ? 'Signing out…' : 'Sign out and switch account'}
            </Button>
          }
        >
          It was sent to <strong>{invitation.email}</strong>, but you&apos;re signed in as{' '}
          <strong>{currentEmail ?? 'an account without an email address'}</strong>.
        </Screen>
      ) : (
        <Screen
          title={`Join ${target}?`}
          actions={
            <>
              <Button onClick={() => void accept()} disabled={isAccepting}>
                {isAccepting ? 'Joining…' : 'Accept invitation'}
              </Button>
              <Button asChild variant="ghost">
                <Link to="/accounts">Not now</Link>
              </Button>
            </>
          }
        >
          {inviter} invited you to join as {role}.
        </Screen>
      )}
      {error ? (
        <Alert variant="destructive" className="mt-6">
          <CircleAlertIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </AuthLayout>
  )
}
