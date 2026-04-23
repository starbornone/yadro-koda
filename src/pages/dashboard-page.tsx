import { useDashboardPage } from '@/features/dashboard/hooks/use-dashboard-page'
import { SidebarLeft } from '@/components/sidebar/sidebar-left'
import { SidebarRight } from '@/components/sidebar/sidebar-right'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export const DashboardPage = () => {
  const { isLoading, user, profile } = useDashboardPage()

  const displayNameFromMetadata =
    typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null
  const avatarFromMetadata =
    typeof user?.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : typeof user?.user_metadata?.picture === 'string'
        ? user.user_metadata.picture
        : ''
  const resolvedName = profile?.display_name?.trim() || displayNameFromMetadata || 'User'
  const resolvedEmail = profile?.email || user?.email || ''

  if (isLoading) {
    return null
  }

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">
                    Project Management & Task Tracking
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="mx-auto h-24 w-full max-w-3xl rounded-xl bg-muted/50" />
          <div className="mx-auto h-[100vh] w-full max-w-3xl rounded-xl bg-muted/50" />
        </div>
      </SidebarInset>
      <SidebarRight
        user={{
          name: resolvedName,
          email: resolvedEmail,
          avatar: avatarFromMetadata,
        }}
      />
    </SidebarProvider>
  )
}
