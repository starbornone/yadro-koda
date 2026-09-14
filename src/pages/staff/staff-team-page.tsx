import { ChevronDownIcon, CircleAlertIcon, Trash2Icon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { useStaffTeamPage } from '@/features/staff/hooks/use-staff-team-page'
import { PLATFORM_ROLE_LABELS } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/format'
import type { PlatformMember, PlatformRole } from '@/lib/supabase/platform'

const ROLES = Object.keys(PLATFORM_ROLE_LABELS) as PlatformRole[]

const memberName = (member: PlatformMember) =>
  member.profile.display_name?.trim() || member.profile.email || 'Unnamed'

export const StaffTeamPage = () => {
  const { members, currentUserId, canManage, busyUserId, error, changeRole, remove } =
    useStaffTeamPage()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Team' }]} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            People who work on the platform itself.
            {canManage ? ' Admins can change roles and remove people.' : ''}
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Since</TableHead>
                {canManage ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId
                const busy = busyUserId === member.user_id
                const name = memberName(member)

                return (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {name}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">you</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.profile.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      {canManage && !isSelf ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              aria-label={`Change role for ${name}`}
                            >
                              {PLATFORM_ROLE_LABELS[member.role]}
                              <ChevronDownIcon data-icon="inline-end" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuRadioGroup
                              value={member.role}
                              onValueChange={(value) =>
                                void changeRole(member.user_id, value as PlatformRole)
                              }
                            >
                              {ROLES.map((role) => (
                                <DropdownMenuRadioItem key={role} value={role}>
                                  {PLATFORM_ROLE_LABELS[role]}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        PLATFORM_ROLE_LABELS[member.role]
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.created_at)}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        {isSelf ? null : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busy}
                                aria-label={`Remove ${name}`}
                              >
                                <Trash2Icon />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {name} from the team?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  They keep their account and any organisation memberships, but lose
                                  access to the staff area immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void remove(member.user_id)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
