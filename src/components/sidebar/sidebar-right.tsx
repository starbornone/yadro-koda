import * as React from 'react'

import { Calendars } from '@/components/calendar/calendars'
import { DatePicker } from '@/components/calendar/date-picker'
import { NavUser } from '@/components/navigation/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { PlusIcon } from 'lucide-react'

const data = {
  calendars: [
    {
      name: 'My Calendars',
      items: ['Personal', 'Work', 'Family'],
    },
    {
      name: 'Favorites',
      items: ['Holidays', 'Birthdays'],
    },
    {
      name: 'Other',
      items: ['Travel', 'Reminders', 'Deadlines'],
    },
  ],
}

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function SidebarRight({ user, ...props }: SidebarRightProps) {
  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh border-l lg:flex" {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser user={user} />
      </SidebarHeader>
      <SidebarContent>
        <DatePicker />
        <SidebarSeparator className="mx-0" />
        <Calendars calendars={data.calendars} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <PlusIcon />
              <span>New Calendar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
