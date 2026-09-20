import { Link, getRouteApi } from '@tanstack/react-router'
import {
  BanknoteIcon,
  Building2Icon,
  CircleAlertIcon,
  RepeatIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useRouteAction } from '@/hooks/use-route-action'
import { ActivityEntry } from '@/features/crm/components/activity-entry'
import { CUSTOMER_STAGE_LABELS, PIPELINE_STAGES, WON_STAGE } from '@/features/crm/stages'
import { formatDay, formatMoney, today } from '@/lib/format'
import { CUSTOMER_STAGES, setTaskCompleted } from '@/lib/supabase/crm'
import { cn } from '@/lib/utils'

const route = getRouteApi('/_authenticated/_staff/staff')

/**
 * Counts and money across every organisation, the pipeline by stage, renewals coming up, the
 * viewer's own follow-ups, and the latest entries on every customer's timeline.
 */
export const StaffOverviewPage = () => {
  const overview = route.useLoaderData()
  const { busy, error, run } = useRouteAction()

  // What the open deals add up to, and what the won ones bring in a year.
  const pipelineValue = PIPELINE_STAGES.reduce(
    (sum, stage) => sum + overview.stages[stage].value,
    0,
  )
  const recurringValue = overview.stages[WON_STAGE].value

  const stats = [
    {
      label: 'Organisations',
      value: String(overview.organisations),
      icon: Building2Icon,
      to: '/staff/organisations' as const,
    },
    { label: 'Memberships', value: String(overview.memberships), icon: UsersIcon },
    {
      label: 'Staff',
      value: String(overview.staff),
      icon: ShieldIcon,
      to: '/staff/team' as const,
    },
    { label: 'Pipeline', value: formatMoney(pipelineValue), icon: BanknoteIcon },
    { label: 'Annual recurring revenue', value: formatMoney(recurringValue), icon: RepeatIcon },
  ]

  return (
    <>
      <PageHeader crumbs={[{ label: 'Staff' }]} />
      <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Everything across every organisation.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  <span className="flex flex-col items-end">
                    <span className="text-lg font-semibold tabular-nums">
                      {overview.stages[stage].count}
                    </span>
                    {overview.stages[stage].value > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(overview.stages[stage].value)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="renewals-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="renewals-heading" className="text-base font-medium">
              Renewals
            </h2>
            <p className="text-sm text-muted-foreground">
              Active customers renewing in the next 90 days.
            </p>
          </div>
          {overview.renewals.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing renews in the next 90 days.
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {overview.renewals.map((renewal) => {
                const overdue = renewal.renews_on < today()
                return (
                  <li key={renewal.org_id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <Link
                        to="/staff/organisations/$orgId"
                        params={{ orgId: renewal.org_id }}
                        className="font-medium hover:underline"
                      >
                        {renewal.organisation.name}
                      </Link>
                      {renewal.plan ? (
                        <span className="ml-2 text-xs text-muted-foreground">{renewal.plan}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(renewal.annual_value)}
                    </span>
                    <time
                      dateTime={renewal.renews_on}
                      className={cn(
                        'shrink-0 text-xs text-muted-foreground',
                        overdue && 'font-medium text-destructive',
                      )}
                    >
                      {overdue ? 'Overdue · ' : ''}
                      {formatDay(renewal.renews_on)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
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

        <section aria-labelledby="latest-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="latest-heading" className="text-base font-medium">
              Latest
            </h2>
            <p className="text-sm text-muted-foreground">
              What happened most recently, across every organisation.
            </p>
          </div>
          {overview.activities.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing logged yet.
            </p>
          ) : (
            <ol className="flex flex-col divide-y rounded-xl border">
              {overview.activities.map((activity) => (
                <ActivityEntry
                  key={activity.id}
                  activity={activity}
                  organisation={activity.organisation}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}
