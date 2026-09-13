import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { appRoute } from '@/lib/auth/app-route'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'
import { ORG_ROLE_LABELS } from '@/lib/auth/permissions'
import { setActiveOrganisation } from '@/lib/supabase/organisations'

/**
 * Shows the active organisation and lets the user switch. The choice is stored on their
 * profile; invalidating the router makes the `_app` loader pick it up.
 */
export function OrgSwitcher() {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const { user } = authenticatedRoute.useRouteContext()
  const { org, role, memberships } = appRoute.useLoaderData()
  const [switching, setSwitching] = useState(false)

  const switchTo = async (orgId: string) => {
    if (switching || orgId === org.id) return

    setSwitching(true)
    try {
      await setActiveOrganisation(user.id, orgId)
      await router.invalidate()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={switching}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2Icon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{org.name}</span>
                <span className="truncate text-xs">{ORG_ROLE_LABELS[role]}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organisations
            </DropdownMenuLabel>
            {memberships.map((membership) => (
              <DropdownMenuItem
                key={membership.org_id}
                onClick={() => void switchTo(membership.org_id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-xs border">
                  <Building2Icon className="size-3.5 shrink-0" />
                </div>
                <span className="flex-1 truncate">{membership.organisation.name}</span>
                {membership.org_id === org.id ? <CheckIcon className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link to="/app/organisations/new">
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">New organisation</div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
