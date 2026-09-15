import { Link, getRouteApi } from '@tanstack/react-router'
import { Building2Icon, CircleAlertIcon, ShieldIcon, UsersIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useCrmAction } from '@/features/crm/hooks/use-crm-action'
import { CUSTOMER_STAGE_LABELS } from '@/features/crm/stages'
import { formatDay, today } from '@/lib/format'
import { CUSTOMER_STAGES, setTaskCompleted } from '@/lib/supabase/crm'
import { cn } from '@/lib/utils'

const route = getRouteApi('/_authenticated/_staff/staff')

/** Counts across every organisation, the pipeline by stage, and the viewer's own follow-ups. */
export const StaffOverviewPage = () => {
  const overview = route.useLoaderData()
  const { busy, error, run } = useCrmAction()

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
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
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

        <section aria-labelledby="pipeline-heading" className="flex flex-col gap-3">
          <h2 id="pipeline-heading" className="text-base font-medium">
            Pipeline
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {CUSTOMER_STAGES.map((stage) => (
              <li key={stage}>
                <Link
                  to="/staff/organisations"
                  search={{ stage }}
                  className="flex items-baseline justify-between gap-2 rounded-xl border px-3 py-2 outline-none hover:bg-accent focus-visible:ring-2"
                >
                  <span className="text-sm">{CUSTOMER_STAGE_LABELS[stage]}</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {overview.stages[stage]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="my-tasks-heading" className="flex flex-col gap-3">
          <h2 id="my-tasks-heading" className="text-base font-medium">
            Your tasks
          </h2>
          {error ? (
            <Alert variant="destructive">
              <CircleAlertIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {overview.tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing assigned to you. Tasks are added from an organisation's page.
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {overview.tasks.map((task) => {
                const overdue = task.due_on !== null && task.due_on < today()
                return (
                  <li key={task.id} className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={false}
                      disabled={busy !== null}
                      onCheckedChange={() =>
                        void run(task.id, () => setTaskCompleted(task.id, true))
                      }
                      aria-label={`Complete ${task.title}`}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      {task.title}
                      <Link
                        to="/staff/organisations/$orgId"
                        params={{ orgId: task.org_id }}
                        className="ml-2 text-xs text-muted-foreground hover:underline"
                      >
                        {task.organisation.name}
                      </Link>
                    </span>
                    {task.due_on ? (
                      <time
                        dateTime={task.due_on}
                        className={cn(
                          'shrink-0 text-xs text-muted-foreground',
                          overdue && 'font-medium text-destructive',
                        )}
                      >
                        {overdue ? 'Overdue · ' : ''}
                        {formatDay(task.due_on)}
                      </time>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
