import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckIcon, CircleAlertIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { ProposalLinesTable } from '@/features/proposals/components/proposal-lines-table'
import { ProposalStatusBadge } from '@/features/proposals/components/proposal-status-badge'
import { useStaffProposalPage } from '@/features/proposals/hooks/use-staff-proposal-page'
import { PRICE_BOOK_KIND_LABELS } from '@/features/proposals/labels'
import { formatDateTime, formatMoney, today } from '@/lib/format'
import type { Contact } from '@/lib/supabase/crm'
import {
  PRICE_BOOK_KINDS,
  proposalLink,
  type PriceBookItem,
  type ProposalInput,
  type ProposalLine,
  type ProposalLineInput,
} from '@/lib/supabase/proposals'

const OTHER = '__other__'
const CUSTOM = '__custom__'

/**
 * One proposal: priced and sent from here while a draft; handed over and, if need be,
 * withdrawn once sent; read afterwards as the record of what was offered and what came back.
 */
export const StaffProposalPage = () => {
  const {
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
  } = useStaffProposalPage()
  const [editingDetails, setEditingDetails] = useState(false)
  // 'new' for the add form, a line id for its edit form, null for neither.
  const [editingLine, setEditingLine] = useState<'new' | string | null>(null)
  const [validUntil, setValidUntil] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const editable = isDraft && canManage
  const recipient = contacts.find((contact) => contact.id === proposal.contact_id)
  const lineBeingEdited = proposal.lines.find((line) => line.id === editingLine)

  const facts: Array<[label: string, value: string]> = [
    ['Sent to', recipient ? `${recipient.name} (${proposal.email})` : proposal.email],
    ...(proposal.sent_at ? [['Sent', formatDateTime(proposal.sent_at)] as [string, string]] : []),
    ...(state === 'sent' || state === 'expired'
      ? [['Link expires', formatDateTime(proposal.expires_at)] as [string, string]]
      : []),
    ...(proposal.accepted_at
      ? [
          ['Accepted', formatDateTime(proposal.accepted_at)] as [string, string],
          ['Accepted from', proposal.accepted_from ?? '—'] as [string, string],
        ]
      : []),
    ...(proposal.declined_at
      ? [
          ['Declined', formatDateTime(proposal.declined_at)] as [string, string],
          ['Reason', proposal.declined_reason ?? '—'] as [string, string],
        ]
      : []),
    ...(proposal.withdrawn_at
      ? [['Withdrawn', formatDateTime(proposal.withdrawn_at)] as [string, string]]
      : []),
  ]

  const copyLink = async () => {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(proposalLink(proposal.token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Could not copy. Select the link and copy it by hand.')
    }
  }

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send(validUntil)
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Staff', to: '/staff' },
          { label: 'Organisations', to: '/staff/organisations' },
          {
            label: organisation.name,
            to: '/staff/organisations/$orgId',
            params: { orgId: organisation.id },
          },
          { label: proposal.title },
        ]}
      />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
            <ProposalStatusBadge state={state} />
          </div>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {editable ? (
          <section aria-labelledby="details-heading" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h2 id="details-heading" className="text-base font-medium">
                Details
              </h2>
              {!editingDetails ? (
                <Button variant="outline" size="sm" onClick={() => setEditingDetails(true)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit details
                </Button>
              ) : null}
            </div>
            {editingDetails ? (
              <DetailsForm
                proposal={proposal}
                contacts={contacts}
                saving={busy === 'details'}
                onSave={(input) => {
                  void saveDetails(input).then((ok) => ok && setEditingDetails(false))
                }}
                onCancel={() => setEditingDetails(false)}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {proposal.notes ?? 'No notes for the recipient.'}
              </p>
            )}
          </section>
        ) : proposal.notes ? (
          <section aria-labelledby="notes-heading" className="flex flex-col gap-2">
            <h2 id="notes-heading" className="text-base font-medium">
              Notes
            </h2>
            <p className="text-sm whitespace-pre-wrap">{proposal.notes}</p>
          </section>
        ) : null}

        <section aria-labelledby="lines-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id="lines-heading" className="text-base font-medium">
              Lines
            </h2>
            {editable && editingLine === null ? (
              <Button variant="outline" size="sm" onClick={() => setEditingLine('new')}>
                <PlusIcon data-icon="inline-start" />
                Add line
              </Button>
            ) : null}
          </div>
          <ProposalLinesTable
            lines={proposal.lines}
            total={proposal.total_amount}
            annual={proposal.annual_amount}
            actions={
              editable
                ? (line) => (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy !== null}
                        aria-label={`Edit ${line.description}`}
                        onClick={() => setEditingLine(line.id ?? null)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy !== null}
                        aria-label={`Remove ${line.description}`}
                        onClick={() => line.id && void removeLine(line.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  )
                : undefined
            }
          />
          {editable && editingLine !== null ? (
            <LineForm
              key={editingLine}
              line={lineBeingEdited}
              position={lineBeingEdited?.position ?? proposal.lines.length}
              priceBook={priceBook}
              saving={busy === (lineBeingEdited?.id ?? 'line')}
              onSave={(input) => {
                void saveLine(input, lineBeingEdited?.id).then((ok) => ok && setEditingLine(null))
              }}
              onCancel={() => setEditingLine(null)}
            />
          ) : null}
        </section>

        {editable ? (
          <form onSubmit={handleSend} className="max-w-md">
            <FieldSet>
              <FieldLegend>Send</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="proposal-valid-until">Valid until</FieldLabel>
                  <Input
                    id="proposal-valid-until"
                    type="date"
                    value={validUntil}
                    min={today()}
                    onChange={(event) => setValidUntil(event.target.value)}
                  />
                  <FieldDescription>Leave empty for 30 days from now.</FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={busy !== null || proposal.lines.length === 0}>
                    {busy === 'send' ? 'Sending…' : 'Send proposal'}
                  </Button>
                  <ConfirmButton
                    type="button"
                    variant="ghost"
                    disabled={busy !== null}
                    title="Discard this draft?"
                    description="Nothing has been sent; the draft is deleted."
                    actionLabel="Discard"
                    onConfirm={() => void discard()}
                  >
                    Discard draft
                  </ConfirmButton>
                </Field>
                <FieldDescription>
                  Sending freezes the lines and gives you a link to pass on. Only a sign-in with{' '}
                  {proposal.email} can accept it.
                </FieldDescription>
              </FieldGroup>
            </FieldSet>
          </form>
        ) : null}

        {state === 'sent' && canManage ? (
          <section aria-labelledby="link-heading" className="flex max-w-xl flex-col gap-3">
            <h2 id="link-heading" className="text-base font-medium">
              Link
            </h2>
            <p className="text-sm text-muted-foreground">
              Send this to {proposal.email}. Nothing is emailed by the app.
            </p>
            <div className="flex gap-2">
              <Input
                aria-label="Proposal link"
                value={proposalLink(proposal.token)}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <Button type="button" variant="outline" onClick={() => void copyLink()}>
                {copied ? <CheckIcon data-icon="inline-start" /> : null}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {copyError ? <p className="text-sm text-destructive">{copyError}</p> : null}
            <div>
              <ConfirmButton
                variant="outline"
                disabled={busy !== null}
                title="Withdraw this proposal?"
                description="The link stops working. The proposal stays on the record, and you can send a new one."
                actionLabel="Withdraw"
                onConfirm={() => void withdraw()}
              >
                {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw proposal'}
              </ConfirmButton>
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}

type DetailsFormProps = {
  proposal: { title: string; email: string; contact_id: string | null; notes: string | null }
  contacts: Contact[]
  saving: boolean
  onSave: (input: ProposalInput) => void
  onCancel: () => void
}

const DetailsForm = ({ proposal, contacts, saving, onSave, onCancel }: DetailsFormProps) => {
  const withEmail = contacts.filter((contact) => contact.email)
  const [title, setTitle] = useState(proposal.title)
  const [contactId, setContactId] = useState(proposal.contact_id ?? OTHER)
  const [email, setEmail] = useState(proposal.email)
  const [notes, setNotes] = useState(proposal.notes ?? '')

  const chosen = withEmail.find((contact) => contact.id === contactId)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({ title, email: chosen?.email ?? email, contact_id: chosen?.id ?? null, notes })
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
        <Field>
          <FieldLabel htmlFor="proposal-notes">Notes for the recipient</FieldLabel>
          <Textarea
            id="proposal-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Terms, what happens after acceptance, who to ask…"
          />
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

type LineFormProps = {
  /** The line being edited; absent when adding. */
  line?: ProposalLine
  position: number
  priceBook: PriceBookItem[]
  saving: boolean
  onSave: (input: ProposalLineInput) => void
  onCancel: () => void
}

/** A line from the price book (pick an item, set the quantity) or a bespoke one. */
const LineForm = ({ line, position, priceBook, saving, onSave, onCancel }: LineFormProps) => {
  const [itemId, setItemIdValue] = useState(line?.price_book_item_id ?? priceBook[0]?.id ?? CUSTOM)
  const [description, setDescription] = useState(line?.description ?? priceBook[0]?.name ?? '')
  const [kind, setKind] = useState<ProposalLineInput['kind']>(
    line?.kind ?? priceBook[0]?.kind ?? 'one_off',
  )
  const [quantity, setQuantity] = useState(String(line?.quantity ?? 1))
  const [unitAmount, setUnitAmount] = useState(
    String(line?.unit_amount ?? priceBook[0]?.unit_amount ?? 0),
  )

  // Picking an item fills the line in; everything stays editable.
  const setItemId = (value: string) => {
    setItemIdValue(value)
    const item = priceBook.find((candidate) => candidate.id === value)
    if (item) {
      setDescription(item.name)
      setKind(item.kind)
      setUnitAmount(String(item.unit_amount))
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({
      price_book_item_id: itemId === CUSTOM ? null : itemId,
      description,
      kind,
      quantity: Number(quantity),
      unit_amount: Number(unitAmount),
      position,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="line-item">From the price book</FieldLabel>
          <NativeSelect
            id="line-item"
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            className="w-full"
          >
            {priceBook.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name} — {formatMoney(item.unit_amount)}{' '}
                {PRICE_BOOK_KIND_LABELS[item.kind].toLowerCase()}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={CUSTOM}>Something else</NativeSelectOption>
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="line-description">Description</FieldLabel>
            <Input
              id="line-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={200}
              autoComplete="off"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="line-kind">Recurs</FieldLabel>
            <NativeSelect
              id="line-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as ProposalLineInput['kind'])}
              className="w-full"
            >
              {PRICE_BOOK_KINDS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {PRICE_BOOK_KIND_LABELS[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="line-quantity">Quantity</FieldLabel>
            <Input
              id="line-quantity"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="line-price">Unit price</FieldLabel>
            <Input
              id="line-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={unitAmount}
              onChange={(event) => setUnitAmount(event.target.value)}
              required
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : line ? 'Save line' : 'Add line'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
