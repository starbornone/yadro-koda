import type { User } from '@supabase/supabase-js'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Profile } from '@/lib/supabase/profiles'

type AccountDetailsProps = {
  user: User
  profile: Profile | null
}

const providerLabel = (providers: string[] | null | undefined, fallback: string | null) => {
  const list = providers?.length ? providers : fallback ? [fallback] : []
  return list.length ? list.join(', ') : '—'
}

/** Read-only facts owned by Supabase Auth; edit these via the auth flows, not the profile. */
export function AccountDetails({ user, profile }: AccountDetailsProps) {
  const rows: Array<[label: string, value: string]> = [
    ['Email', profile?.email || user.email || '—'],
    ['Signed in with', providerLabel(profile?.providers, profile?.provider ?? null)],
    ['Member since', formatDate(profile?.created_at ?? user.created_at)],
    ['Last sign-in', formatDateTime(profile?.last_sign_in_at ?? user.last_sign_in_at)],
  ]

  return (
    <section aria-labelledby="account-details-heading" className="flex flex-col gap-3">
      <h2 id="account-details-heading" className="text-base font-medium">
        Account
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
