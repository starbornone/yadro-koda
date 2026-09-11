import { Link, useMatchRoute, type LinkProps } from '@tanstack/react-router'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export type NavMainItem = {
  title: string
  icon: React.ReactNode
  /** Route to navigate to. Items without one render as inert buttons until they have a page. */
  to?: LinkProps['to']
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  const matchRoute = useMatchRoute()

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          {item.to ? (
            <SidebarMenuButton asChild isActive={Boolean(matchRoute({ to: item.to }))}>
              <Link to={item.to}>
                {item.icon}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton>
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
