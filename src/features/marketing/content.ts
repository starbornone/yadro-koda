import {
  CalendarDaysIcon,
  FolderKanbanIcon,
  LayersIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react'
import { siteConfig } from '@/config/site'

// Placeholder marketing copy. Everything on the public site reads from here, so replacing it
// with real messaging is a one-file change.

export const homeContent = {
  meta: {
    title: `${siteConfig.title} — one calm workspace for your team's work`,
    description:
      'Projects, tasks and calendars in one place, so the work — not the tooling — gets your attention.',
  },
  hero: {
    eyebrow: 'Now in early access',
    headline: 'The core of how your team works.',
    subhead:
      'Bring projects, tasks and calendars into one calm workspace. Less switching, fewer tabs, and everything exactly where you left it.',
    primaryCta: 'Get started',
    secondaryCta: 'Sign in',
    signedInCta: 'Go to dashboard',
  },
  features: {
    heading: 'Everything in one place',
    subhead: 'The tools you already use, without the sprawl.',
    items: [
      {
        icon: LayersIcon,
        title: 'Workspaces and pages',
        description:
          'Group work by team, project or life area. Pages nest as deep as you need and stay easy to find.',
      },
      {
        icon: FolderKanbanIcon,
        title: 'Projects and tasks',
        description:
          'Plan in lists or boards, assign owners, set due dates, and see progress without a status meeting.',
      },
      {
        icon: CalendarDaysIcon,
        title: 'Shared calendars',
        description:
          'Personal, team and project calendars side by side. Toggle what you see; never miss what matters.',
      },
      {
        icon: SearchIcon,
        title: 'Search that keeps up',
        description:
          'Jump to any page, task or event from anywhere. Favourites keep the things you use daily one click away.',
      },
      {
        icon: SparklesIcon,
        title: 'Ask AI',
        description:
          'Summarise a project, draft an update, or find the decision you half-remember — right where the work lives.',
      },
      {
        icon: ShieldCheckIcon,
        title: 'Private by default',
        description:
          'Your data is scoped to you and your team at the database level. Nothing is shared unless you share it.',
      },
    ],
  },
  cta: {
    heading: 'Ready to get organised?',
    subhead: 'Create an account in under a minute. No credit card required.',
    button: 'Create your account',
    signedInButton: 'Open your dashboard',
  },
  footer: {
    tagline: 'One calm workspace for your team.',
  },
} as const
