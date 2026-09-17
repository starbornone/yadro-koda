import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { InvitationsSection } from '@/components/invitations-section'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ActivitySection } from '@/features/crm/components/activity-section'
import { ContactsSection } from '@/features/crm/components/contacts-section'
import { PipelineForm } from '@/features/crm/components/pipeline-form'
import { StageBadge } from '@/features/crm/components/stage-badge'
import { TasksSection } from '@/features/crm/components/tasks-section'
import { DeleteOrganisationSection } from '@/features/organisations/components/delete-organisation-section'
import { MembersSection } from '@/features/organisations/components/members-section'
import { useStaffOrganisationPage } from '@/features/staff/hooks/use-staff-organisation-page'
import { personName } from '@/lib/auth/display-user'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/format'
import { createInvitation, revokeInvitation } from '@/lib/supabase/invitations'

/**
 * The customer record: one organisation as staff see it — where it sits in the pipeline, who
 * to talk to, what has happened, what is next, who its members are and who has been invited.
 */
export const StaffOrganisationPage = () => {
  const {
    organisation,
    customer,
    contacts,
    activities,
    tasks,
    staff,
    invitations,
    currentUserId,
    canRename,
    canDelete,
    afterDelete,
    canManageMember,
    assignableRoles,
    canManageCustomers,
    canLogActivity,
    rename,
  } = useStaffOrganisationPage()

  const facts: Array<[label: string, value: string]> = [
    ['URL name', organisation.slug],
    ['Created', formatDate(organisation.created_at)],
    ['Owner', customer.owner ? personName(customer.owner) : 'Unassigned'],
    ['Members', String(organisation.members.length)],
  ]

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Staff', to: '/staff' },
          { label: 'Organisations', to: '/staff/organisations' },
          { label: organisation.name },
        ]}
      />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{organisation.name}</h1>
            <StageBadge stage={customer.stage} />
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

        <section aria-labelledby="pipeline-heading" className="flex flex-col gap-3">
          <h2 id="pipeline-heading" className="text-base font-medium">
            Pipeline
          </h2>
          <PipelineForm customer={customer} staff={staff} canManage={canManageCustomers} />
        </section>

        <ContactsSection
          orgId={organisation.id}
          contacts={contacts}
          currentUserId={currentUserId}
          canLog={canLogActivity}
          canManage={canManageCustomers}
        />

        <TasksSection
          orgId={organisation.id}
          tasks={tasks}
          staff={staff}
          currentUserId={currentUserId}
          canLog={canLogActivity}
          canManage={canManageCustomers}
        />

        <ActivitySection
          orgId={organisation.id}
          activities={activities}
          contacts={contacts}
          currentUserId={currentUserId}
          canLog={canLogActivity}
          canManage={canManageCustomers}
        />

        <MembersSection
          orgId={organisation.id}
          members={organisation.members}
          currentUserId={currentUserId}
          canManageMember={canManageMember}
          assignableRoles={assignableRoles}
        />

        {assignableRoles.length > 0 ? (
          <InvitationsSection
            invitations={invitations}
            assignableRoles={assignableRoles}
            roleLabels={ORG_ROLE_LABELS}
            description="Invite someone to this organisation on its behalf, then send them the link. They join once they sign in with that address and open it."
            create={(input) => createInvitation(organisation.id, input)}
            revoke={revokeInvitation}
          />
        ) : null}

        {canRename ? (
          <form onSubmit={rename.handleRename} className="max-w-md">
            <FieldSet>
              <FieldLegend>Manage organisation</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="staff-org-name">Organisation name</FieldLabel>
                  <Input
                    id="staff-org-name"
                    type="text"
                    value={rename.name}
                    onChange={(event) => rename.setName(event.target.value)}
                    maxLength={100}
                    required
                  />
                </Field>
                {rename.error ? (
                  <Alert variant="destructive">
                    <CircleAlertIcon className="size-4" />
                    <AlertDescription>{rename.error}</AlertDescription>
                  </Alert>
                ) : null}
                {rename.message ? (
                  <Alert>
                    <CircleCheckIcon className="size-4" />
                    <AlertDescription>{rename.message}</AlertDescription>
                  </Alert>
                ) : null}
                <Field orientation="horizontal">
                  <Button type="submit" disabled={rename.isSaving || !rename.isDirty}>
                    {rename.isSaving ? 'Saving…' : 'Rename'}
                  </Button>
                </Field>
              </FieldGroup>
            </FieldSet>
          </form>
        ) : null}

        {canDelete ? (
          <DeleteOrganisationSection organisation={organisation} afterDelete={afterDelete} />
        ) : null}
      </div>
    </>
  )
}
