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
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { formatDateTime } from '@/lib/format'
import {
  createInvitation,
  invitationLink,
  invitationStatus,
  revokeInvitation,
  type Invitation,
} from '@/lib/supabase/invitations'
import type { OrgRole } from '@/lib/supabase/organisations'

type InvitationsSectionProps = {
  orgId: string
  /** Open invitations: pending and expired. Accepted ones are not shown. */
  invitations: Invitation[]
  /** The roles the viewer may invite as. Render the section only when there is at least one. */
  assignableRoles: readonly OrgRole[]
}

/**
 * Inviting people and the invitations still open. Nothing is emailed: the app builds a link
 * from each invitation's token and the inviter passes it on however they like.
 */
export const InvitationsSection = ({
  orgId,
  invitations,
  assignableRoles,
}: InvitationsSectionProps) => {
  const { busy, error, run } = useRouteAction()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>(assignableRoles.at(-1) ?? 'member')
  // The invitation just created, so its link can be shown right away.
  const [created, setCreated] = useState<Invitation | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void run('invite', async () => {
      setCreated(await createInvitation(orgId, { email, role }))
      setEmail('')
    })
  }

  const copyLink = async (invitation: Invitation) => {
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
        <p className="text-sm text-muted-foreground">
          Invite someone by email, then send them the link. They join once they sign in with that
          address and open it.
        </p>
      </div>

      <form onSubmit={handleInvite} className="max-w-md">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field>
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
                onChange={(event) => setRole(event.target.value as OrgRole)}
              >
                {assignableRoles.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {ORG_ROLE_LABELS[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
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
                <TableHead>Expires</TableHead>
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
                    <TableCell>{ORG_ROLE_LABELS[invitation.role]}</TableCell>
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
                            onConfirm={() =>
                              void run(invitation.id, () => revokeInvitation(invitation.id))
                            }
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
