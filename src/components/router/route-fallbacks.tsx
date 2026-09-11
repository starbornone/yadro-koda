import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { CircleAlertIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-svh items-center justify-center p-6">{children}</div>
)

/** Shown while a route's guard, loader or lazy chunk is still in flight (after `pendingMs`). */
export function RoutePending() {
  return (
    <Centered>
      <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading…</span>
    </Centered>
  )
}

/** Route-level error boundary. Retrying re-runs the guards and loaders for the current URL. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  const retry = () => {
    void router.invalidate()
    reset()
  }

  return (
    <Centered>
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <CircleAlertIcon className="size-8 text-destructive" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
        <Button onClick={retry}>Try again</Button>
      </div>
    </Centered>
  )
}

export function RouteNotFound() {
  return (
    <Centered>
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">There&apos;s nothing at this address.</p>
        </div>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </Centered>
  )
}
