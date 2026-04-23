import { CircleAlert, CircleCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type AuthFeedbackProps = {
  error: string | null
  message: string | null
}

export const AuthFeedback = ({ error, message }: AuthFeedbackProps) => {
  if (!error && !message) {
    return null
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-6 pb-6 md:px-10">
      {error ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>Auth error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert>
          <CircleCheck className="size-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
