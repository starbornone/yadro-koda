import { CircleAlertIcon, LogOutIcon } from 'lucide-react'
import { ConfirmButton } from '@/components/confirm-button'
import { InvitationsSection } from '@/components/invitations-section'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MembersSection } from '@/features/organisations/components/members-section'
import { useMembersPage } from '@/features/organisations/hooks/use-members-page'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { createInvitation, revokeInvitation } from '@/lib/supabase/invitations'

export const MembersPage = () => {
  const {
    org,
    role,
    members,
    invitations,
    currentUserId,
    canManage,
    canManageMember,
    assignableRoles,
    leave,
  } = useMembersPage()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Members' }]} />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">People in {org.name}</h1>
            <p className="text-muted-foreground">
              {canManage
                ? 'Owners and admins can invite people, change roles and remove members.'
                : `Only owners and admins can manage members. Your role is ${ORG_ROLE_LABELS[role]}.`}
            </p>
          </div>

          <MembersSection
            orgId={org.id}
            members={members}
            currentUserId={currentUserId}
            canManageMember={canManageMember}
            assignableRoles={assignableRoles}
          />

          {canManage ? (
            <InvitationsSection
              invitations={invitations}
              assignableRoles={assignableRoles}
              roleLabels={ORG_ROLE_LABELS}
              description="Invite someone by email, then send them the link. They join once they sign in with that address and open it."
              create={(input) => createInvitation(org.id, input)}
              revoke={revokeInvitation}
            />
          ) : null}

          <section aria-labelledby="leave-heading" className="flex flex-col gap-3">
            <div>
              <h2 id="leave-heading" className="text-base font-medium">
                Leave {org.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {leave.isLastOwner
                  ? "You're the only owner. Make someone else an owner before you leave."
                  : 'You lose access immediately. An owner or admin can invite you back later.'}
              </p>
            </div>
            {leave.error ? (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" />
                <AlertDescription>{leave.error}</AlertDescription>
              </Alert>
            ) : null}
            <div>
              <ConfirmButton
                variant="outline"
                disabled={leave.isLastOwner || leave.isLeaving}
                title={`Leave ${org.name}?`}
                description="You lose access immediately. An owner or admin can invite you back later."
                actionLabel="Leave"
                onConfirm={() => void leave.leave()}
              >
                <LogOutIcon data-icon="inline-start" />
                {leave.isLeaving ? 'Leaving…' : 'Leave organisation'}
              </ConfirmButton>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
