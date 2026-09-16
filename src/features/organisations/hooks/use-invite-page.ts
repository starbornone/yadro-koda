import { useCallback, useState } from 'react'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import {
  acceptInvitation,
  invitationStatus,
  type InvitationPreview,
} from '@/lib/supabase/invitations'

const route = getRouteApi('/invite/$token')

export type InviteView =
  | 'not-found'
  | 'expired'
  | 'accepted'
  | 'signed-out'
  | 'wrong-account'
  | 'ready'

// The invitation's own state comes first; only a pending one cares who is looking at it.
const resolveView = (
  invitation: InvitationPreview | null,
  signedIn: boolean,
  currentEmail: string | null,
): InviteView => {
  if (!invitation) return 'not-found'
  const status = invitationStatus(invitation)
  if (status !== 'pending') return status
  if (!signedIn) return 'signed-out'
  return currentEmail === invitation.email ? 'ready' : 'wrong-account'
}

/**
 * The invitation behind the link and what the visitor can do with it. `view` folds the
 * invitation's state and the session together so the page is a switch, not a decision tree.
 */
export const useInvitePage = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const { token } = route.useParams()
  const { user } = route.useRouteContext()
  const invitation = route.useLoaderData()
  const { signOut, isSigningOut, error: signOutError } = useSignOut()
  const [isAccepting, setIsAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // The database compares profile emails; this only decides which screen to show.
  const currentEmail = user?.email?.trim().toLowerCase() || null
  const view = resolveView(invitation, user !== null, currentEmail)

  const accept = useCallback(async () => {
    if (isAccepting) return

    setIsAccepting(true)
    setAcceptError(null)

    try {
      await acceptInvitation(token)
      // The `_authenticated` loader owns memberships and the active organisation; refreshing
      // it is what lets `/app` open inside the organisation just joined.
      await router.invalidate()
      await navigate({ to: '/app' })
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : 'Could not accept the invitation.')
      setIsAccepting(false)
    }
  }, [isAccepting, navigate, router, token])

  return {
    token,
    invitation,
    view,
    currentEmail,
    isAccepting,
    accept,
    signOut,
    isSigningOut,
    error: acceptError ?? signOutError,
  }
}
