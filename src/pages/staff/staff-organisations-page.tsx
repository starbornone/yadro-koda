import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StageBadge } from '@/features/crm/components/stage-badge'
import { CUSTOMER_STAGE_LABELS } from '@/features/crm/stages'
import { personName } from '@/lib/auth/display-user'
import { canOnPlatform } from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'
import { formatDate } from '@/lib/format'
import { CUSTOMER_STAGES } from '@/lib/supabase/crm'
import { cn } from '@/lib/utils'

const route = getRouteApi('/_authenticated/_staff/staff/organisations')

/** Every organisation in the pipeline, at any stage, searchable and filterable by stage. */
export const StaffOrganisationsPage = () => {
  const organisations = route.useLoaderData()
  const { q = '', stage } = route.useSearch()
  const { platformRole } = staffRoute.useLoaderData()
  const navigate = useNavigate()
  const [query, setQuery] = useState(q)

  const canCreate = canOnPlatform(platformRole, 'platform:manage-customers')

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void navigate({ to: '/staff/organisations', search: { q: query.trim() || undefined, stage } })
  }

  const describe = () => {
    const count = organisations.length
    const noun = stage
      ? `${CUSTOMER_STAGE_LABELS[stage].toLowerCase()} ${count === 1 ? 'organisation' : 'organisations'}`
      : count === 1
        ? 'organisation'
        : 'organisations'
    return `${count} ${noun}${q ? ` matching “${q}”` : ''}`
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Organisations' }]} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>
            <p className="text-muted-foreground">{describe()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={search} role="search" className="flex items-center gap-2">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or URL name"
                aria-label="Search organisations"
                className="w-64"
              />
              <Button type="submit" variant="outline" size="icon" aria-label="Search">
                <SearchIcon />
              </Button>
            </form>
            {canCreate ? (
              <Button asChild>
                <Link to="/staff/organisations/new">
                  <PlusIcon data-icon="inline-start" />
                  New organisation
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <nav aria-label="Filter by stage" className="flex flex-wrap gap-1">
          <StageFilterLink q={q} stage={undefined} active={stage === undefined}>
            All
          </StageFilterLink>
          {CUSTOMER_STAGES.map((option) => (
            <StageFilterLink key={option} q={q} stage={option} active={stage === option}>
              {CUSTOMER_STAGE_LABELS[option]}
            </StageFilterLink>
          ))}
        </nav>

        {organisations.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {q || stage ? 'No organisations match.' : 'No organisations yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organisations.map((organisation) => (
                  <TableRow key={organisation.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/staff/organisations/$orgId"
                        params={{ orgId: organisation.id }}
                        className="hover:underline"
                      >
                        {organisation.name}
                      </Link>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {organisation.slug}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={organisation.stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {organisation.owner ? personName(organisation.owner) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {organisation.member_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(organisation.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  )
}

type StageFilterLinkProps = {
  q: string
  stage: (typeof CUSTOMER_STAGES)[number] | undefined
  active: boolean
  children: React.ReactNode
}

const StageFilterLink = ({ q, stage, active, children }: StageFilterLinkProps) => (
  <Button asChild variant={active ? 'secondary' : 'ghost'} size="sm">
    <Link
      to="/staff/organisations"
      search={{ q: q || undefined, stage }}
      aria-current={active ? 'page' : undefined}
      className={cn(active && 'font-medium')}
    >
      {children}
    </Link>
  </Button>
)
