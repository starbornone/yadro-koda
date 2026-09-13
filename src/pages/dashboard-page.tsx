import { PageHeader } from '@/components/layout/page-header'
import { appRoute } from '@/lib/auth/app-route'

export const DashboardPage = () => {
  const { org } = appRoute.useLoaderData()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Dashboard' }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground">
            Nothing here yet. This is where the product&apos;s main view goes.
          </p>
        </div>
        <div className="mx-auto h-24 w-full max-w-3xl rounded-xl bg-muted/50" />
        <div className="mx-auto h-[60vh] w-full max-w-3xl rounded-xl bg-muted/50" />
      </div>
    </>
  )
}
