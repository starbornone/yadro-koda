import type { ReactNode } from 'react'
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
import { Button } from '@/components/ui/button'

type ConfirmButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick' | 'title'> & {
  /** The question the dialog asks, e.g. "Remove Ada?". */
  title: string
  description?: string
  /** Label of the confirming action; defaults to the button's accessible name. */
  actionLabel?: string
  onConfirm: () => void
  children: ReactNode
}

/** A button that asks before doing something irreversible. */
export const ConfirmButton = ({
  title,
  description,
  actionLabel,
  onConfirm,
  children,
  ...buttonProps
}: ConfirmButtonProps) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button {...buttonProps}>{children}</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>
          {actionLabel ?? buttonProps['aria-label'] ?? 'Confirm'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
