import { Link, getRouteApi } from '@tanstack/react-router'
import { Building2Icon, ShieldIcon, UsersIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const route = getRouteApi('/_authenticated/_staff/staff')

export const StaffOverviewPage = () => {
  const overview = route.useLoaderData()

  const stats = [
    {
      label: 'Organisations',
      value: overview.organisations,
      icon: Building2Icon,
      to: '/staff/organisations' as const,
    },
    { label: 'Memberships', value: overview.memberships, icon: UsersIcon },
    { label: 'Staff', value: overview.staff, icon: ShieldIcon, to: '/staff/team' as const },
  ]

  return (
    <>
      <PageHeader crumbs={[{ label: 'Staff' }]} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Everything across every organisation.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, to }) => {
            const card = (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardDescription>{label}</CardDescription>
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
                </CardHeader>
              </Card>
            )
            return to ? (
              <Link key={label} to={to} className="rounded-xl outline-none focus-visible:ring-2">
                {card}
              </Link>
            ) : (
              <div key={label}>{card}</div>
            )
          })}
        </div>
      </div>
    </>
  )
}
