import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRightLeftIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { ACTIVITY_KIND_LABELS } from '@/features/crm/stages'
import { personName } from '@/lib/auth/display-user'
import { formatDateTime } from '@/lib/format'
import type { Activity } from '@/lib/supabase/crm'
import type { Organisation } from '@/lib/supabase/organisations'

const KIND_ICONS: Record<Activity['kind'], typeof MailIcon> = {
  note: MessageSquareTextIcon,
  call: PhoneIcon,
  email: MailIcon,
  meeting: UsersRoundIcon,
  stage_change: ArrowRightLeftIcon,
  joined: UserPlusIcon,
  enquiry: GlobeIcon,
}

/** Who did it: the author, or the website when the visitor did it themselves. */
const byline = (activity: Activity) =>
  activity.kind === 'enquiry' && !activity.author ? 'Website' : personName(activity.author)

type ActivityEntryProps = {
  activity: Activity
  /** Who the entry was with (or, for an enquiry, from), when the listing knows and it is worth saying. */
  withContact?: string
  /** Where it happened, when the listing spans organisations. */
  organisation?: Pick<Organisation, 'id' | 'name'>
  /** Anything to show on the right, e.g. a delete button. */
  children?: ReactNode
}

/**
 * One timeline entry: who, what, where and when on one line, then what was said. The same
 * row on a customer record and in the feed across every customer.
 */
export const ActivityEntry = ({
  activity,
  withContact,
  organisation,
  children,
}: ActivityEntryProps) => {
  const Icon = KIND_ICONS[activity.kind]

  return (
    <li className="flex gap-3 p-4">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" aria-label={ACTIVITY_KIND_LABELS[activity.kind]} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{byline(activity)}</span>
          {' · '}
          {ACTIVITY_KIND_LABELS[activity.kind]}
          {withContact ? `${activity.kind === 'enquiry' ? ' from ' : ' with '}${withContact}` : ''}
          {organisation ? (
            <>
              {' · '}
              <Link
                to="/staff/organisations/$orgId"
                params={{ orgId: organisation.id }}
                className="font-medium text-foreground hover:underline"
              >
                {organisation.name}
              </Link>
            </>
          ) : null}
          {' · '}
          <time dateTime={activity.occurred_at}>{formatDateTime(activity.occurred_at)}</time>
        </p>
        <p className="text-sm whitespace-pre-wrap">{activity.body}</p>
      </div>
      {children}
    </li>
  )
}
