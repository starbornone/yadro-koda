import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { homeContent } from '@/features/marketing/content'
import { useAuth } from '@/lib/auth/auth-store'
import { cn } from '@/lib/utils'

const Section = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={cn('mx-auto w-full max-w-6xl px-4 md:px-6', className)}>{children}</section>
)

const Hero = ({ signedIn }: { signedIn: boolean }) => {
  const { hero } = homeContent

  return (
    <Section className="flex flex-col items-center gap-6 py-20 text-center md:py-28">
      <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        {hero.eyebrow}
      </span>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
        {hero.headline}
      </h1>
      <p className="max-w-2xl text-lg text-balance text-muted-foreground">{hero.subhead}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {signedIn ? (
          <Button asChild size="lg">
            <Link to="/app">
              {hero.signedInCta}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link to={homeContent.getStartedPath}>
                {hero.primaryCta}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">{hero.secondaryCta}</Link>
            </Button>
          </>
        )}
      </div>
    </Section>
  )
}

const Features = () => {
  const { features } = homeContent

  return (
    <Section className="flex flex-col gap-10 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">{features.heading}</h2>
        <p className="text-muted-foreground">{features.subhead}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.items.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </Section>
  )
}

const CallToAction = ({ signedIn }: { signedIn: boolean }) => {
  const { cta } = homeContent

  return (
    <Section className="py-16">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-muted/50 px-6 py-12 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">{cta.heading}</h2>
        <p className="text-muted-foreground">{cta.subhead}</p>
        <Button asChild size="lg">
          <Link to={signedIn ? '/app' : homeContent.getStartedPath}>
            {signedIn ? cta.signedInButton : cta.button}
          </Link>
        </Button>
      </div>
    </Section>
  )
}

export const HomePage = () => {
  const signedIn = useAuth().status === 'signed-in'

  return (
    <>
      <Hero signedIn={signedIn} />
      <Features />
      <CallToAction signedIn={signedIn} />
    </>
  )
}
