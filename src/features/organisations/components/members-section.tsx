import { ChevronDownIcon, CircleAlertIcon, Trash2Icon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRouteAction } from '@/hooks/use-route-action'
import { personName } from '@/lib/auth/display-user'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  removeMember,
  updateMembershipRole,
  type OrgRole,
  type OrganisationMember,
} from '@/lib/supabase/organisations'

type MembersSectionProps = {
  orgId: string
  members: OrganisationMember[]
  currentUserId: string
  /** Whether the viewer may change or remove this member. The section never offers it on the viewer's own row. */
  canManageMember: (member: OrganisationMember) => boolean
  /** The roles the viewer may hand out; empty when they manage nobody. */
  assignableRoles: readonly OrgRole[]
  /** Shown under the heading. */
  description?: string
}

/**
 * Who belongs to the organisation. Shared by the tenant's members page and the staff customer
 * record: each passes in what its viewer may do, and the section owns the writes.
 */
export const MembersSection = ({
  orgId,
  members,
  currentUserId,
  canManageMember,
  assignableRoles,
  description,
}: MembersSectionProps) => {
  const { busy, error, run } = useRouteAction()
  const canManage = assignableRoles.length > 0

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="members-heading" className="text-base font-medium">
          Members
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nobody has joined yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Access ends</TableHead>
                {canManage ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId
                const editable = !isSelf && canManageMember(member)
                const name = personName(member.profile)

                return (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {member.profile.display_name?.trim() || '—'}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">you</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.profile.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy !== null}
                              aria-label={`Change role for ${name}`}
                            >
                              {ORG_ROLE_LABELS[member.role]}
                              <ChevronDownIcon data-icon="inline-end" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuRadioGroup
                              value={member.role}
                              onValueChange={(value) =>
                                void run(member.user_id, () =>
                                  updateMembershipRole(orgId, member.user_id, value as OrgRole),
                                )
                              }
                            >
                              {assignableRoles.map((role) => (
                                <DropdownMenuRadioItem key={role} value={role}>
                                  {ORG_ROLE_LABELS[role]}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        ORG_ROLE_LABELS[member.role]
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.expires_at ? formatDateTime(member.expires_at) : 'Never'}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        {editable ? (
                          <ConfirmButton
                            variant="ghost"
                            size="icon-sm"
                            disabled={busy !== null}
                            aria-label={`Remove ${name}`}
                            title={`Remove ${name} from the organisation?`}
                            description="They keep their account but lose access immediately. You can invite them again later."
                            actionLabel="Remove"
                            onConfirm={() =>
                              void run(member.user_id, () => removeMember(orgId, member.user_id))
                            }
                          >
                            <Trash2Icon />
                          </ConfirmButton>
                        ) : null}
                      </TableCell>
                    ) : null}
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
