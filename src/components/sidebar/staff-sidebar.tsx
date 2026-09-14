import * as React from 'react'
import {
  Building2Icon,
  LayoutDashboardIcon,
  ShieldIcon,
  SquareArrowOutUpRightIcon,
  UsersIcon,
} from 'lucide-react'
import { NavMain, type NavMainItem } from '@/components/navigation/nav-main'
import { NavUser } from '@/components/navigation/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { siteConfig } from '@/config/site'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { resolveDisplayUser } from '@/lib/auth/display-user'
import { PLATFORM_ROLE_LABELS } from '@/lib/auth/permissions'
import { staffRoute } from '@/lib/auth/staff-route'

const navMain: NavMainItem[] = [
  { title: 'Overview', icon: <LayoutDashboardIcon />, to: '/staff' },
  { title: 'Organisations', icon: <Building2Icon />, to: '/staff/organisations', fuzzy: true },
  { title: 'Team', icon: <UsersIcon />, to: '/staff/team' },
]

/** Staff-area sidebar: platform identity, cross-tenant navigation, signed-in user. */
export function StaffSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = authenticatedRoute.useRouteContext()
  const { profile } = authenticatedRoute.useLoaderData()
  const { platformRole, hasOrganisations } = staffRoute.useLoaderData()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{siteConfig.title} staff</span>
                <span className="truncate text-xs">{PLATFORM_ROLE_LABELS[platformRole]}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <NavMain items={navMain} />
        </SidebarGroup>
        {hasOrganisations ? (
          <SidebarGroup>
            <SidebarGroupLabel>Elsewhere</SidebarGroupLabel>
            <NavMain
              items={[
                { title: 'Your organisation', icon: <SquareArrowOutUpRightIcon />, to: '/app' },
              ]}
            />
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
