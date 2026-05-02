'use client'

import * as React from 'react'

import { NavFavorites } from '@/components/navigation/nav-favorites'
import { NavMain } from '@/components/navigation/nav-main'
import { NavSecondary } from '@/components/navigation/nav-secondary'
import { NavWorkspaces } from '@/components/navigation/nav-workspaces'
import { TeamSwitcher } from '@/components/navigation/team-switcher'
import { siteConfig } from '@/config/site'
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import {
  TerminalIcon,
  SearchIcon,
  SparklesIcon,
  HomeIcon,
  InboxIcon,
  CalendarIcon,
  Settings2Icon,
} from 'lucide-react'

const data = {
  teams: [
    {
      name: siteConfig.title,
      logo: <TerminalIcon />,
      plan: 'Enterprise',
    },
  ],
  navMain: [
    {
      title: 'Search',
      url: '#',
      icon: <SearchIcon />,
    },
    {
      title: 'Ask AI',
      url: '#',
      icon: <SparklesIcon />,
    },
    {
      title: 'Home',
      url: '#',
      icon: <HomeIcon />,
      isActive: true,
    },
    {
      title: 'Inbox',
      url: '#',
      icon: <InboxIcon />,
      badge: '10',
    },
  ],
  navSecondary: [
    {
      title: 'Calendar',
      url: '#',
      icon: <CalendarIcon />,
    },
    {
      title: 'Settings',
      url: '#',
      icon: <Settings2Icon />,
    },
  ],
  favorites: [
    {
      name: 'Project Management & Task Tracking',
      url: '#',
    },
  ],
  workspaces: [
    {
      name: 'Professional Development',
      pages: [
        {
          name: 'Career Objectives & Milestones',
          url: '#',
        },
        {
          name: 'Skill Acquisition & Training Log',
          url: '#',
        },
        {
          name: 'Networking Contacts & Events',
          url: '#',
        },
      ],
    },
    {
      name: 'Home Management',
      pages: [
        {
          name: 'Household Budget & Expense Tracking',
          url: '#',
        },
        {
          name: 'Home Maintenance Schedule & Tasks',
          url: '#',
        },
        {
          name: 'Family Calendar & Event Planning',
          url: '#',
        },
      ],
    },
  ],
}

export function SidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={data.navMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites favorites={data.favorites} />
        <NavWorkspaces workspaces={data.workspaces} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
