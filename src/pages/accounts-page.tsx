import { Link } from '@tanstack/react-router'
import {
  Building2Icon,
  ChevronRightIcon,
  CircleAlertIcon,
  PlusIcon,
  ShieldIcon,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { useAccountsPage } from '@/features/accounts/hooks/use-accounts-page'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { ORG_ROLE_LABELS, PLATFORM_ROLE_LABELS } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'

type AccountRowProps = {
  icon: React.ReactNode
  title: string
  subtitle: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}

const AccountRow = ({ icon, title, subtitle, busy, disabled, onClick }: AccountRowProps) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors',
        'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-60',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="grid flex-1 leading-tight">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="text-xs text-muted-foreground">{busy ? 'Opening…' : null}</span>
      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
    </button>
  </li>
)

/** Shown after sign-in to anyone with more than one place to go: staff area, organisations. */
export const AccountsPage = () => {
  const { memberships, platformRole, busyId, error, chooseOrganisation, chooseStaff } =
    useAccountsPage()
  const { signOut, isSigningOut } = useSignOut()

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Choose an account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            You can switch at any time from the user menu.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ul className="flex flex-col gap-2">
          {platformRole ? (
            <AccountRow
              icon={<ShieldIcon className="size-4" />}
              title={`${siteConfig.title} staff`}
              subtitle={PLATFORM_ROLE_LABELS[platformRole]}
              busy={busyId === 'staff'}
              disabled={busyId !== null}
              onClick={chooseStaff}
            />
          ) : null}
          {memberships.map((membership) => (
            <AccountRow
              key={membership.org_id}
              icon={<Building2Icon className="size-4" />}
              title={membership.organisation.name}
              subtitle={ORG_ROLE_LABELS[membership.role]}
              busy={busyId === membership.org_id}
              disabled={busyId !== null}
              onClick={() => void chooseOrganisation(membership.org_id)}
            />
          ))}
        </ul>

        <div className="flex items-center justify-between text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link to={memberships.length ? '/app/organisations/new' : '/onboarding'}>
              <PlusIcon data-icon="inline-start" />
              New organisation
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
