import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ActivitySection } from '@/features/crm/components/activity-section'
import { ContactsSection } from '@/features/crm/components/contacts-section'
import { PipelineForm } from '@/features/crm/components/pipeline-form'
import { StageBadge } from '@/features/crm/components/stage-badge'
import { TasksSection } from '@/features/crm/components/tasks-section'
import { useStaffOrganisationPage } from '@/features/staff/hooks/use-staff-organisation-page'
import { personName } from '@/lib/auth/display-user'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { formatDate, formatDateTime } from '@/lib/format'

/**
 * The customer record: one organisation as staff see it — where it sits in the pipeline, who
 * to talk to, what has happened, what is next, and (once it has users) who its members are.
 */
export const StaffOrganisationPage = () => {
  const {
    organisation,
    customer,
    contacts,
    activities,
    tasks,
    staff,
    currentUserId,
    canRename,
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

        <section aria-labelledby="org-members-heading" className="flex flex-col gap-3">
          <h2 id="org-members-heading" className="text-base font-medium">
            Members
          </h2>
          {organisation.members.length === 0 ? (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organisation.members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">
                        {member.profile.display_name?.trim() || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.profile.email ?? '—'}
                      </TableCell>
                      <TableCell>{ORG_ROLE_LABELS[member.role]}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(member.created_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.expires_at ? formatDateTime(member.expires_at) : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

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
      </div>
    </>
  )
}
