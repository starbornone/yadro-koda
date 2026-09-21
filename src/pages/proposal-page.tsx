import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { siteConfig } from '@/config/site'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { ProposalLinesTable } from '@/features/proposals/components/proposal-lines-table'
import { useProposalPage } from '@/features/proposals/hooks/use-proposal-page'
import { formatDateTime } from '@/lib/format'
import type { ProposalPreview } from '@/lib/supabase/proposals'

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

/** The offer itself: the lines and totals, and any notes, as staff wrote them. */
const Offer = ({ proposal }: { proposal: ProposalPreview }) => (
  <div className="flex flex-col gap-4 text-left">
    <ProposalLinesTable
      lines={proposal.lines}
      total={proposal.total_amount}
      annual={proposal.annual_amount}
    />
    {proposal.notes ? <p className="text-sm whitespace-pre-wrap">{proposal.notes}</p> : null}
  </div>
)

/** Where a proposal link lands. One screen per state; `useProposalPage` picks which. */
export const ProposalPage = () => {
  const {
    token,
    proposal,
    view,
    currentEmail,
    busy,
    accept,
    decline,
    signOut,
    isSigningOut,
    error,
  } = useProposalPage()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  const sender = proposal?.sent_by_name ?? 'Someone'
  const from = `${sender} from ${siteConfig.title}`

  const handleDecline = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void decline(reason)
  }

  return (
    <AuthLayout wide={view === 'ready' || view === 'signed-out'}>
      {!proposal || view === 'not-found' ? (
        <Screen title="This proposal link isn't valid" actions={<HomeLink />}>
          It may have been withdrawn, or the link was copied incompletely. Ask whoever sent it for a
          new one.
        </Screen>
      ) : view === 'expired' ? (
        <Screen title="This proposal has expired" actions={<HomeLink />}>
          {sender} sent you “{proposal.title}”, but it was valid until{' '}
          {formatDateTime(proposal.expires_at)}. Ask them for a fresh one.
        </Screen>
      ) : view === 'withdrawn' ? (
        <Screen title="This proposal has been withdrawn" actions={<HomeLink />}>
          {sender} took “{proposal.title}” back. If you were expecting it, ask them for a new one.
        </Screen>
      ) : view === 'accepted' ? (
        <Screen
          title="This proposal has been accepted"
          actions={
            <Button asChild>
              <Link to="/accounts">Continue to the app</Link>
            </Button>
          }
        >
          “{proposal.title}” was accepted on {formatDateTime(proposal.accepted_at)}. If that was
          you, {proposal.organisation_name} is ready for you.
        </Screen>
      ) : view === 'declined' ? (
        <Screen title="This proposal was declined" actions={<HomeLink />}>
          “{proposal.title}” was declined on {formatDateTime(proposal.declined_at)}. {sender} can
          send a new one if things change.
        </Screen>
      ) : view === 'signed-out' ? (
        <Screen
          title={proposal.title}
          actions={
            <>
              <Offer proposal={proposal} />
              <Button asChild>
                <Link to="/signup" search={{ redirect: `/proposal/${token}` }}>
                  Create an account to accept
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login" search={{ redirect: `/proposal/${token}` }}>
                  I already have one
                </Link>
              </Button>
            </>
          }
        >
          {from} sent this proposal for {proposal.organisation_name} to{' '}
          <strong>{proposal.email}</strong>. Sign in with that address to accept or decline it.
          Valid until {formatDateTime(proposal.expires_at)}.
        </Screen>
      ) : view === 'wrong-account' ? (
        <Screen
          title="This proposal is for a different account"
          actions={
            <Button variant="outline" onClick={() => void signOut()} disabled={isSigningOut}>
              {isSigningOut ? 'Signing out…' : 'Sign out and switch account'}
            </Button>
          }
        >
          It was sent to <strong>{proposal.email}</strong>, but you&apos;re signed in as{' '}
          <strong>{currentEmail ?? 'an account without an email address'}</strong>.
        </Screen>
      ) : (
        <Screen
          title={proposal.title}
          actions={
            <>
              <Offer proposal={proposal} />
              {declining ? (
                <form onSubmit={handleDecline} className="rounded-xl border bg-card p-4 text-left">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="decline-reason">Why not? (optional)</FieldLabel>
                      <Textarea
                        id="decline-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        maxLength={500}
                      />
                    </Field>
                    <Field orientation="horizontal">
                      <Button type="submit" variant="destructive" disabled={busy !== null}>
                        {busy === 'decline' ? 'Declining…' : 'Decline proposal'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setDeclining(false)}
                        disabled={busy !== null}
                      >
                        Back
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              ) : (
                <>
                  <Button onClick={() => void accept()} disabled={busy !== null}>
                    {busy === 'accept' ? 'Accepting…' : 'Accept proposal'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeclining(true)}
                    disabled={busy !== null}
                  >
                    Decline
                  </Button>
                </>
              )}
            </>
          }
        >
          {from} sent this proposal for {proposal.organisation_name} to you. Accepting makes you the
          owner of {proposal.organisation_name} on {siteConfig.title} and records that you accepted
          it, and when. Valid until {formatDateTime(proposal.expires_at)}.
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
