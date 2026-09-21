import { useCallback, useState } from 'react'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import {
  acceptProposal,
  declineProposal,
  proposalState,
  type ProposalPreview,
} from '@/lib/supabase/proposals'

const route = getRouteApi('/proposal/$token')

export type ProposalView =
  | 'not-found'
  | 'expired'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'signed-out'
  | 'wrong-account'
  | 'ready'

// The proposal's own state comes first; only an open one cares who is looking at it.
const resolveView = (
  proposal: ProposalPreview | null,
  signedIn: boolean,
  currentEmail: string | null,
): ProposalView => {
  if (!proposal) return 'not-found'
  const state = proposalState(proposal)
  if (state !== 'sent') return state === 'draft' ? 'not-found' : state
  if (!signedIn) return 'signed-out'
  return currentEmail === proposal.email ? 'ready' : 'wrong-account'
}

/** What the browser can say about itself, kept on the record as where the acceptance came from. */
const acceptedFrom = () =>
  typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 500)

/**
 * The proposal behind the link and what the visitor can do with it. `view` folds the
 * proposal's state and the session together so the page is a switch, not a decision tree.
 */
export const useProposalPage = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const { token } = route.useParams()
  const { user } = route.useRouteContext()
  const proposal = route.useLoaderData()
  const { signOut, isSigningOut, error: signOutError } = useSignOut()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The database compares profile emails; this only decides which screen to show.
  const currentEmail = user?.email?.trim().toLowerCase() || null
  const view = resolveView(proposal, user !== null, currentEmail)

  const accept = useCallback(async () => {
    if (busy || !proposal) return

    setBusy('accept')
    setError(null)

    try {
      await acceptProposal(token, acceptedFrom())
      // The `_authenticated` loader owns memberships and the active organisation; refreshing
      // it is what lets the app open on the organisation just joined.
      await router.invalidate()
      await navigate({ to: '/app' })
    } catch (acceptError) {
      setError(
        acceptError instanceof Error ? acceptError.message : 'Could not accept the proposal.',
      )
      setBusy(null)
    }
  }, [busy, navigate, proposal, router, token])

  const decline = useCallback(
    async (reason: string) => {
      if (busy || !proposal) return

      setBusy('decline')
      setError(null)

      try {
        await declineProposal(token, reason)
        // The loader re-reads the proposal, now declined, and the page shows that.
        await router.invalidate()
      } catch (declineError) {
        setError(
          declineError instanceof Error ? declineError.message : 'Could not decline the proposal.',
        )
      } finally {
        setBusy(null)
      }
    },
    [busy, proposal, router, token],
  )

  return {
    token,
    proposal,
    view,
    currentEmail,
    busy,
    accept,
    decline,
    signOut,
    isSigningOut,
    error: error ?? signOutError,
  }
}
