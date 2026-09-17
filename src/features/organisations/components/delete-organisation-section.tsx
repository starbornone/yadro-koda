import { useState } from 'react'
import { CircleAlertIcon, Trash2Icon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { deleteOrganisation, type Organisation } from '@/lib/supabase/organisations'

type DeleteOrganisationSectionProps = {
  organisation: Pick<Organisation, 'id' | 'name' | 'slug'>
  /** Where to go once it is gone; the caller knows which loaders to refresh and which page to land on. */
  afterDelete: () => Promise<void>
}

/**
 * The one irreversible thing an owner can do. The dialog asks for the URL name to be typed
 * back, so a stray click cannot do it, and stays open on failure so the reason is readable.
 */
export const DeleteOrganisationSection = ({
  organisation,
  afterDelete,
}: DeleteOrganisationSectionProps) => {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmed = confirmation.trim() === organisation.slug

  const handleDelete = async () => {
    if (isDeleting || !confirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      const deleted = await deleteOrganisation(organisation.id)
      if (!deleted) {
        throw new Error('Nothing was deleted. You may no longer have permission to do this.')
      }
      await afterDelete()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the organisation.',
      )
      setIsDeleting(false)
    }
  }

  return (
    <section aria-labelledby="delete-org-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="delete-org-heading" className="text-base font-medium">
          Delete organisation
        </h2>
        <p className="text-sm text-muted-foreground">
          Removes {organisation.name}, everyone&apos;s membership of it and everything recorded
          about it. This cannot be undone.
        </p>
      </div>
      <div>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (isDeleting) return
            setOpen(next)
            setConfirmation('')
            setError(null)
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              Delete organisation
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {organisation.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Every member loses access immediately and nothing can be recovered. Type the
                organisation&apos;s URL name, <strong>{organisation.slug}</strong>, to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="delete-org-confirmation">URL name</FieldLabel>
              <Input
                id="delete-org-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={isDeleting}
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              {/* Stay open while deleting (and on failure); the page navigates away on success. */}
              <AlertDialogAction
                disabled={!confirmed || isDeleting}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDelete()
                }}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  )
}
