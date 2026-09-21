import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CheckIcon, CircleAlertIcon, LinkIcon, PlusIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProposalStatusBadge } from '@/features/proposals/components/proposal-status-badge'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { Contact } from '@/lib/supabase/crm'
import type { Organisation } from '@/lib/supabase/organisations'
import {
  createProposal,
  proposalLink,
  proposalState,
  type Proposal,
} from '@/lib/supabase/proposals'

type ProposalsSectionProps = {
  organisation: Pick<Organisation, 'id' | 'name'>
  proposals: Proposal[]
  contacts: Contact[]
  /** Whether the viewer may draft (superadmin, admin). */
  canManage: boolean
}

const OTHER = '__other__'

/** Deals offered to this customer, and where to start a new one. */
export const ProposalsSection = ({
  organisation,
  proposals,
  contacts,
  canManage,
}: ProposalsSectionProps) => {
  const navigate = useNavigate()
  const [drafting, setDrafting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyLink = async (proposal: Proposal) => {
    setError(null)
    try {
      await navigator.clipboard.writeText(proposalLink(proposal.token))
      setCopiedId(proposal.id)
      setTimeout(() => setCopiedId((current) => (current === proposal.id ? null : current)), 2000)
    } catch {
      setError(`Could not copy. The link is ${proposalLink(proposal.token)}`)
    }
  }

  // The draft's own page loads it fresh, so nothing here needs refreshing on the way out.
  const startDraft = async (input: { title: string; email: string; contact_id: string | null }) => {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const created = await createProposal(organisation.id, input)
      await navigate({
        to: '/staff/organisations/$orgId/proposals/$proposalId',
        params: { orgId: organisation.id, proposalId: created.id },
      })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the draft.')
      setCreating(false)
    }
  }

  return (
    <section aria-labelledby="proposals-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="proposals-heading" className="text-base font-medium">
          Proposals
        </h2>
        {canManage && !drafting ? (
          <Button variant="outline" size="sm" onClick={() => setDrafting(true)}>
            <PlusIcon data-icon="inline-start" />
            New proposal
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {drafting ? (
        <NewProposalForm
          organisationName={organisation.name}
          contacts={contacts}
          saving={creating}
          onCreate={(input) => void startDraft(input)}
          onCancel={() => setDrafting(false)}
        />
      ) : null}

      {proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No proposals yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Per year</TableHead>
                <TableHead>Link expires</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => {
                const state = proposalState(proposal)
                return (
                  <TableRow key={proposal.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/staff/organisations/$orgId/proposals/$proposalId"
                        params={{ orgId: organisation.id, proposalId: proposal.id }}
                        className="hover:underline"
                      >
                        {proposal.title}
                      </Link>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {proposal.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ProposalStatusBadge state={state} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(proposal.total_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(proposal.annual_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {state === 'sent' ? formatDateTime(proposal.expires_at) : '—'}
                    </TableCell>
                    <TableCell>
                      {state === 'sent' ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Copy link for ${proposal.title}`}
                          onClick={() => void copyLink(proposal)}
                        >
                          {copiedId === proposal.id ? <CheckIcon /> : <LinkIcon />}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

type NewProposalFormProps = {
  organisationName: string
  contacts: Contact[]
  saving: boolean
  onCreate: (input: { title: string; email: string; contact_id: string | null }) => void
  onCancel: () => void
}

/** Title and recipient; the lines come next, on the proposal's own page. */
const NewProposalForm = ({
  organisationName,
  contacts,
  saving,
  onCreate,
  onCancel,
}: NewProposalFormProps) => {
  const withEmail = contacts.filter((contact) => contact.email)
  const primary = withEmail.find((contact) => contact.is_primary) ?? withEmail[0]
  const [title, setTitle] = useState(`Proposal for ${organisationName}`)
  const [contactId, setContactId] = useState(primary?.id ?? OTHER)
  const [email, setEmail] = useState('')

  const chosen = withEmail.find((contact) => contact.id === contactId)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onCreate({
      title,
      email: chosen?.email ?? email,
      contact_id: chosen?.id ?? null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="proposal-title">Title</FieldLabel>
          <Input
            id="proposal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            autoComplete="off"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="proposal-recipient">Send to</FieldLabel>
            <NativeSelect
              id="proposal-recipient"
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              className="w-full"
            >
              {withEmail.map((contact) => (
                <NativeSelectOption key={contact.id} value={contact.id}>
                  {contact.name} ({contact.email})
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={OTHER}>Another email address</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>
              Only a sign-in with this address can accept. It becomes the organisation&apos;s owner.
            </FieldDescription>
          </Field>
          {!chosen ? (
            <Field>
              <FieldLabel htmlFor="proposal-email">Email</FieldLabel>
              <Input
                id="proposal-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="off"
                required
              />
            </Field>
          ) : null}
        </div>
        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Creating…' : 'Create draft'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
