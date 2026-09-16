import { PageHeader } from '@/components/layout/page-header'
import { InvitationsSection } from '@/features/organisations/components/invitations-section'
import { MembersSection } from '@/features/organisations/components/members-section'
import { useMembersPage } from '@/features/organisations/hooks/use-members-page'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'

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
              orgId={org.id}
              invitations={invitations}
              assignableRoles={assignableRoles}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
