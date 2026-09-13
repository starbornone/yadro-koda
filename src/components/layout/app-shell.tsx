import { Outlet } from '@tanstack/react-router'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

/**
 * Chrome for every route under `_app`. Rendered by the layout route itself, so the sidebar
 * stays mounted while pages change underneath.
 */
export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
