import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckIcon, CircleAlertIcon, CircleCheckIcon, LinkIcon, Trash2Icon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { useRouteAction } from '@/hooks/use-route-action'
import { endOfDay, formatDateTime, today } from '@/lib/format'
import { invitationLink, invitationStatus } from '@/lib/supabase/invitations'

/** What the section needs from an invitation, whichever table it came from. */
export type OpenInvitation<Role extends string> = {
  id: string
  email: string
  role: Role
  token: string
  /** When the link stops working. */
  expires_at: string
  /** When the access it grants stops working; absent where access is not time-boxed. */
  access_expires_at?: string | null
}

export type CreateInvitationInput<Role extends string> = {
  email: string
  role: Role
  /** Only sent when the section offers time-boxed access. */
  access_expires_at?: string | null
}

type InvitationsSectionProps<Role extends string> = {
  /** Open invitations: pending and expired. Accepted ones are not shown. */
  invitations: OpenInvitation<Role>[]
  /** The roles the viewer may invite as. Render the section only when there is at least one. */
  assignableRoles: readonly Role[]
  roleLabels: Record<Role, string>
  /** Shown under the heading: who this invites, and to what. */
  description: string
  /** Offer an optional "access ends" date, for memberships that can be time-boxed. */
  timeBoxed?: boolean
  create: (input: CreateInvitationInput<Role>) => Promise<OpenInvitation<Role>>
  revoke: (invitationId: string) => Promise<void>
}

/**
 * Inviting people and the invitations still open — to an organisation or to the staff team,
 * whichever `create` and `revoke` talk to. Nothing is emailed: the app builds a link from each
 * invitation's token and the inviter passes it on however they like.
 */
export function InvitationsSection<Role extends string>({
  invitations,
  assignableRoles,
  roleLabels,
  description,
  timeBoxed = false,
  create,
  revoke,
}: InvitationsSectionProps<Role>) {
  const { busy, error, run } = useRouteAction()
  const [email, setEmail] = useState('')
  // Default to the least privileged role on offer.
  const [role, setRole] = useState<Role>(assignableRoles.at(-1)!)
  const [accessEnds, setAccessEnds] = useState('')
  // The invitation just created, so its link can be shown right away.
  const [created, setCreated] = useState<OpenInvitation<Role> | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void run('invite', async () => {
      setCreated(
        await create({
          email,
          role,
          ...(timeBoxed && { access_expires_at: accessEnds ? endOfDay(accessEnds) : null }),
        }),
      )
      setEmail('')
      setAccessEnds('')
    })
  }

  const copyLink = async (invitation: OpenInvitation<Role>) => {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(invitationLink(invitation.token))
      setCopiedId(invitation.id)
      setTimeout(() => setCopiedId((current) => (current === invitation.id ? null : current)), 2000)
    } catch {
      setCopyError('Could not copy. Select the link and copy it by hand.')
      setCreated(invitation)
    }
  }

  return (
    <section aria-labelledby="invitations-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="invitations-heading" className="text-base font-medium">
          Invitations
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={handleInvite} className="max-w-md">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="off"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <NativeSelect
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                {assignableRoles.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {roleLabels[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {timeBoxed ? (
              <Field>
                <FieldLabel htmlFor="invite-access-ends">Access ends</FieldLabel>
                <Input
                  id="invite-access-ends"
                  type="date"
                  value={accessEnds}
                  min={today()}
                  onChange={(event) => setAccessEnds(event.target.value)}
                />
                <FieldDescription>Leave empty for no end date.</FieldDescription>
              </Field>
            ) : null}
          </div>
          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Field orientation="horizontal">
            <Button type="submit" disabled={busy !== null}>
              {busy === 'invite' ? 'Creating…' : 'Create invitation'}
            </Button>
            <FieldDescription>Links stay valid for 7 days.</FieldDescription>
          </Field>
        </FieldGroup>
      </form>

      {created ? (
        <Alert>
          <CircleCheckIcon className="size-4" />
          <AlertDescription className="flex w-full flex-col gap-2">
            <span>Send this link to {created.email}:</span>
            <span className="flex gap-2">
              <Input
                aria-label={`Invitation link for ${created.email}`}
                value={invitationLink(created.token)}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyLink(created)}
              >
                {copiedId === created.id ? <CheckIcon data-icon="inline-start" /> : null}
                {copiedId === created.id ? 'Copied' : 'Copy'}
              </Button>
            </span>
            {copyError ? <span className="text-destructive">{copyError}</span> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {invitations.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No open invitations.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {timeBoxed ? <TableHead>Access ends</TableHead> : null}
                <TableHead>Link expires</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const expired = invitationStatus(invitation) === 'expired'
                const canRevoke = assignableRoles.includes(invitation.role)

                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>{roleLabels[invitation.role]}</TableCell>
                    {timeBoxed ? (
                      <TableCell className="text-muted-foreground">
                        {invitation.access_expires_at
                          ? formatDateTime(invitation.access_expires_at)
                          : 'Never'}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-muted-foreground">
                      {expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        formatDateTime(invitation.expires_at)
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {!expired ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Copy link for ${invitation.email}`}
                            onClick={() => void copyLink(invitation)}
                          >
                            {copiedId === invitation.id ? <CheckIcon /> : <LinkIcon />}
                          </Button>
                        ) : null}
                        {canRevoke ? (
                          <ConfirmButton
                            variant="ghost"
                            size="icon-sm"
                            disabled={busy !== null}
                            aria-label={`Revoke invitation for ${invitation.email}`}
                            title={`Revoke the invitation for ${invitation.email}?`}
                            description="The link stops working. You can invite them again afterwards."
                            actionLabel="Revoke"
                            onConfirm={() => void run(invitation.id, () => revoke(invitation.id))}
                          >
                            <Trash2Icon />
                          </ConfirmButton>
                        ) : null}
                      </div>
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
