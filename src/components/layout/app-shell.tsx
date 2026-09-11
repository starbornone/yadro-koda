import { Outlet } from '@tanstack/react-router'
import { SidebarLeft } from '@/components/sidebar/sidebar-left'
import { SidebarRight } from '@/components/sidebar/sidebar-right'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { resolveDisplayUser } from '@/lib/auth/display-user'

/**
 * Chrome for every route under `_authenticated`. Rendered by the layout route itself, so the
 * sidebars stay mounted while pages change underneath.
 */
export function AppShell() {
  const { user } = authenticatedRoute.useRouteContext()
  const { profile } = authenticatedRoute.useLoaderData()

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
      <SidebarRight user={resolveDisplayUser(user, profile)} />
    </SidebarProvider>
  )
}
