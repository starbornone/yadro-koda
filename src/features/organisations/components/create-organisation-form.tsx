import type { FormEventHandler } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type CreateOrganisationFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  title?: string
  description?: string
  name: string
  slug: string
  loading: boolean
  error: string | null
  onNameChange: (name: string) => void
  onSlugChange: (slug: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function CreateOrganisationForm({
  className,
  title = 'Create your organisation',
  description = "You'll be its owner and can invite others later.",
  name,
  slug,
  loading,
  error,
  onNameChange,
  onSlugChange,
  onSubmit,
  ...props
}: CreateOrganisationFormProps) {
  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-balance text-muted-foreground">{description}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="org-name">Organisation name</FieldLabel>
          <Input
            id="org-name"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="organization"
            maxLength={100}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="org-slug">URL name</FieldLabel>
          <Input
            id="org-slug"
            type="text"
            value={slug}
            onChange={(event) => onSlugChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            minLength={2}
            maxLength={50}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
          <FieldDescription>
            Lowercase letters, numbers and hyphens. Used in links; can&apos;t be changed later.
          </FieldDescription>
        </Field>

        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create organisation'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
