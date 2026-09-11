import { Link, Outlet } from '@tanstack/react-router'
import { GalleryVerticalEnd } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { homeContent } from '@/features/marketing/content'
import { useAuth } from '@/lib/auth/auth-store'

const Brand = () => (
  <Link to="/" className="flex items-center gap-2 font-medium">
    <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <GalleryVerticalEnd className="size-4" />
    </div>
    {siteConfig.title}
  </Link>
)

/** Header actions depend on whether a session exists; the `_public` guard awaits `ready()`. */
const AuthActions = () => {
  const auth = useAuth()

  if (auth.status === 'signed-in') {
    return (
      <Button asChild size="sm">
        <Link to="/dashboard">Dashboard</Link>
      </Button>
    )
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link to="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link to="/signup">Get started</Link>
      </Button>
    </>
  )
}

/** Chrome for the public (marketing) site: sticky header, page, footer. */
export function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:px-6">
          <Brand />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AuthActions />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex flex-col gap-1">
            <Brand />
            <p>{homeContent.footer.tagline}</p>
          </div>
          <p>
            © {new Date().getFullYear()} {siteConfig.title}
          </p>
        </div>
      </footer>
    </div>
  )
}
