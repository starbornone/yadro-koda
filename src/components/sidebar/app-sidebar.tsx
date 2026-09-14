import * as React from 'react'
import { LayoutDashboardIcon, Settings2Icon, ShieldIcon } from 'lucide-react'
import { NavMain, type NavMainItem } from '@/components/navigation/nav-main'
import { NavUser } from '@/components/navigation/nav-user'
import { OrgSwitcher } from '@/components/navigation/org-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { resolveDisplayUser } from '@/lib/auth/display-user'

const navMain: NavMainItem[] = [
  { title: 'Dashboard', icon: <LayoutDashboardIcon />, to: '/app' },
  { title: 'Settings', icon: <Settings2Icon />, to: '/app/settings' },
]

/** Tenant-app sidebar: active organisation, navigation, signed-in user. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = authenticatedRoute.useRouteContext()
  const { profile, platformRole } = authenticatedRoute.useLoaderData()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <NavMain items={navMain} />
        </SidebarGroup>
        {platformRole ? (
          <SidebarGroup>
            <SidebarGroupLabel>Elsewhere</SidebarGroupLabel>
            <NavMain items={[{ title: 'Staff area', icon: <ShieldIcon />, to: '/staff' }]} />
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={resolveDisplayUser(user, profile)} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
