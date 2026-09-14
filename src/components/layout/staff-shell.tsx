import { Outlet } from '@tanstack/react-router'
import { StaffSidebar } from '@/components/sidebar/staff-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

/** Chrome for every route under `_staff`. */
export function StaffShell() {
  return (
    <SidebarProvider>
      <StaffSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
