import { InvitationsSection } from '@/components/invitations-section'
import { PageHeader } from '@/components/layout/page-header'
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
        </div>
      </div>
    </>
  )
}
