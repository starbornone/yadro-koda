import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
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
import { formatDate } from '@/lib/format'

const route = getRouteApi('/_authenticated/_staff/staff/organisations')

export const StaffOrganisationsPage = () => {
  const organisations = route.useLoaderData()
  const { q = '' } = route.useSearch()
  const navigate = useNavigate()
  const [query, setQuery] = useState(q)

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void navigate({ to: '/staff/organisations', search: { q: query.trim() || undefined } })
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Organisations' }]} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>
            <p className="text-muted-foreground">
              {organisations.length} {organisations.length === 1 ? 'organisation' : 'organisations'}
              {q ? ` matching “${q}”` : ''}
            </p>
          </div>
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
        </div>

        {organisations.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {q ? 'No organisations match that search.' : 'No organisations yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL name</TableHead>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">{organisation.slug}</TableCell>
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
