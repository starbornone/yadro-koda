import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { ArrowLeftRightIcon, BadgeCheckIcon, ChevronsUpDownIcon, LogOutIcon } from 'lucide-react'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { authenticatedRoute } from '@/lib/auth/authenticated-route'

const getAvatarFallback = (displayName: string, email: string) => {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean)

  if (nameParts.length > 0) {
    const initials = nameParts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')

    if (initials) {
      return initials
    }
  }

  const emailFirstLetter = email.trim()[0]?.toUpperCase()
  return emailFirstLetter || '?'
}

export function NavUser({
  user,
  profileTo = '/app/profile',
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  /** The profile page for the shell this menu sits in. */
  profileTo?: '/app/profile' | '/staff/profile'
}) {
  const { isMobile } = useSidebar()
  const { signOut, isSigningOut, error: signOutError } = useSignOut()
  const { memberships, platformRole } = authenticatedRoute.useLoaderData()
  const avatarFallback = getAvatarFallback(user.name, user.email)
  // Staff who also belong to organisations, or members of several, can switch between them.
  const canSwitchAccount = memberships.length + (platformRole ? 1 : 0) > 1

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to={profileTo}>
                  <BadgeCheckIcon />
                  Account
                </Link>
              </DropdownMenuItem>
              {canSwitchAccount ? (
                <DropdownMenuItem asChild>
                  <Link to="/accounts">
                    <ArrowLeftRightIcon />
                    Switch account
                  </Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {signOutError ? (
              <DropdownMenuLabel className="px-2 py-1 text-xs text-destructive">
                {signOutError}
              </DropdownMenuLabel>
            ) : null}
            <DropdownMenuItem onClick={() => void signOut()} disabled={isSigningOut}>
              <LogOutIcon />
              {isSigningOut ? 'Signing out...' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
