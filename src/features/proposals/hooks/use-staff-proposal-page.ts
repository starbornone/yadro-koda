import { useCallback } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useRouteAction } from '@/hooks/use-route-action'
import { canOnPlatform } from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'
import { endOfDay } from '@/lib/format'
import {
  addProposalLine,
  deleteProposal,
  proposalState,
  removeProposalLine,
  sendProposal,
  updateProposal,
  updateProposalLine,
  withdrawProposal,
  type ProposalInput,
  type ProposalLineInput,
} from '@/lib/supabase/proposals'

const route = getRouteApi('/_authenticated/_staff/staff/organisations/$orgId/proposals/$proposalId')

/**
 * One proposal as staff see it: a draft to price and send, or a sent one to hand over and,
 * if need be, withdraw. Every write refreshes the loader so the totals the database keeps
 * are what the page shows.
 */
export const useStaffProposalPage = () => {
  const navigate = useNavigate()
  const { platformRole } = staffRoute.useLoaderData()
  const { organisation, proposal, contacts, priceBook } = route.useLoaderData()
  const { busy, error, run } = useRouteAction()

  const canManage = canOnPlatform(platformRole, 'platform:manage-customers')
  const state = proposalState(proposal)
  const isDraft = proposal.status === 'draft'

  const saveDetails = useCallback(
    (input: ProposalInput) => run('details', () => updateProposal(proposal.id, input)),
    [proposal.id, run],
  )

  const saveLine = useCallback(
    (input: ProposalLineInput, lineId?: string) =>
      run(lineId ?? 'line', () =>
        lineId ? updateProposalLine(lineId, input) : addProposalLine(proposal.id, input),
      ),
    [proposal.id, run],
  )

  const removeLine = useCallback(
    (lineId: string) => run(lineId, () => removeProposalLine(lineId)),
    [run],
  )

  /** `validUntil` is a calendar date; the link works until the end of that day. */
  const send = useCallback(
    (validUntil: string) => run('send', () => sendProposal(proposal.id, endOfDay(validUntil))),
    [proposal.id, run],
  )

  const withdraw = useCallback(
    () => run('withdraw', () => withdrawProposal(proposal.id)),
    [proposal.id, run],
  )

  // Leave before refreshing: the loader would report the proposal missing.
  const discard = useCallback(async () => {
    const ok = await run('discard', async () => {
      await deleteProposal(proposal.id)
      await navigate({ to: '/staff/organisations/$orgId', params: { orgId: organisation.id } })
    })
    return ok
  }, [navigate, organisation.id, proposal.id, run])

  return {
    organisation,
    proposal,
    contacts,
    priceBook,
    state,
    isDraft,
    canManage,
    busy,
    error,
    saveDetails,
    saveLine,
    removeLine,
    send,
    withdraw,
    discard,
  }
}
