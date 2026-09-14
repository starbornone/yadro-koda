import { getRouteApi } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { formatDate, formatDateTime } from '@/lib/format'

const route = getRouteApi('/_authenticated/_staff/staff/organisations/$orgId')

/** Read-only view of one tenant. Staff writes are a product decision (see platform_can_access_org). */
export const StaffOrganisationPage = () => {
  const organisation = route.useLoaderData()

  const facts: Array<[label: string, value: string]> = [
    ['URL name', organisation.slug],
    ['Created', formatDate(organisation.created_at)],
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
          <h1 className="text-2xl font-semibold tracking-tight">{organisation.name}</h1>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section aria-labelledby="org-members-heading" className="flex flex-col gap-3">
          <h2 id="org-members-heading" className="text-base font-medium">
            Members
          </h2>
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
        </section>
      </div>
    </>
  )
}
