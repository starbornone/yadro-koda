import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlertIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCrmAction } from '@/features/crm/hooks/use-crm-action'
import {
  addContact,
  removeContact,
  updateContact,
  type Contact,
  type ContactInput,
} from '@/lib/supabase/crm'

type ContactsSectionProps = {
  orgId: string
  contacts: Contact[]
  currentUserId: string
  /** Whether the viewer may add and edit (every staff tier). */
  canLog: boolean
  /** Whether the viewer may remove anyone's contact (superadmin, admin). */
  canManage: boolean
}

const EMPTY: ContactInput = { name: '', email: null, phone: null, title: null, is_primary: false }

/** People at the customer, whether or not they have a sign-in. */
export const ContactsSection = ({
  orgId,
  contacts,
  currentUserId,
  canLog,
  canManage,
}: ContactsSectionProps) => {
  const { busy, error, run } = useCrmAction()
  // 'new' for the add form, a contact id for its edit form, null for neither.
  const [editing, setEditing] = useState<'new' | string | null>(null)

  const save = async (input: ContactInput, contactId?: string) => {
    const ok = await run(contactId ?? 'new', () =>
      contactId ? updateContact(contactId, input) : addContact(orgId, input),
    )
    if (ok) setEditing(null)
  }

  return (
    <section aria-labelledby="contacts-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="contacts-heading" className="text-base font-medium">
          Contacts
        </h2>
        {canLog && editing !== 'new' ? (
          <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            Add contact
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {editing === 'new' ? (
        <ContactForm
          initial={{ ...EMPTY, is_primary: contacts.length === 0 }}
          saving={busy === 'new'}
          onSave={(input) => void save(input)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {contacts.length === 0 && editing !== 'new' ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No contacts yet.
        </p>
      ) : contacts.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                {canLog ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) =>
                editing === contact.id ? (
                  <TableRow key={contact.id}>
                    <TableCell colSpan={canLog ? 5 : 4}>
                      <ContactForm
                        initial={contact}
                        saving={busy === contact.id}
                        onSave={(input) => void save(input, contact.id)}
                        onCancel={() => setEditing(null)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {contact.name}
                        {contact.is_primary ? <Badge variant="secondary">Primary</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{contact.title ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="hover:underline">
                          {contact.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{contact.phone ?? '—'}</TableCell>
                    {canLog ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {!contact.is_primary ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={busy !== null}
                              aria-label={`Make ${contact.name} the primary contact`}
                              onClick={() =>
                                void run(contact.id, () =>
                                  updateContact(contact.id, { ...contact, is_primary: true }),
                                )
                              }
                            >
                              <StarIcon />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={busy !== null}
                            aria-label={`Edit ${contact.name}`}
                            onClick={() => setEditing(contact.id)}
                          >
                            <PencilIcon />
                          </Button>
                          {canManage || contact.created_by === currentUserId ? (
                            <ConfirmButton
                              variant="ghost"
                              size="icon-sm"
                              disabled={busy !== null}
                              aria-label={`Remove ${contact.name}`}
                              title={`Remove ${contact.name}?`}
                              description="Activities that mention them stay, without the link."
                              actionLabel="Remove"
                              onConfirm={() =>
                                void run(contact.id, () => removeContact(contact.id))
                              }
                            >
                              <Trash2Icon />
                            </ConfirmButton>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  )
}

type ContactFormProps = {
  initial: ContactInput
  saving: boolean
  onSave: (input: ContactInput) => void
  onCancel: () => void
}

const ContactForm = ({ initial, saving, onSave, onCancel }: ContactFormProps) => {
  const [name, setName] = useState(initial.name)
  const [title, setTitle] = useState(initial.title ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [isPrimary, setIsPrimary] = useState(initial.is_primary)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({ name, title, email, phone, is_primary: isPrimary })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contact-name">Name</FieldLabel>
            <Input
              id="contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="off"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-title">Title</FieldLabel>
            <Input
              id="contact-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-email">Email</FieldLabel>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="contact-primary"
            checked={isPrimary}
            onCheckedChange={(checked) => setIsPrimary(checked === true)}
          />
          <Label htmlFor="contact-primary">Primary contact</Label>
        </div>
        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save contact'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
