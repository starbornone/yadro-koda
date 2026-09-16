import { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

/**
 * Runs one write at a time and refreshes the route loaders afterwards, so the page re-renders
 * from the database rather than from optimistic local state. `busy` names the thing being
 * changed (a row id, or a form key) so the UI can disable just that control.
 */
export const useRouteAction = () => {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (key: string, action: () => Promise<void>): Promise<boolean> => {
      if (busy) return false

      setBusy(key)
      setError(null)

      try {
        await action()
        await router.invalidate()
        return true
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Something went wrong.')
        return false
      } finally {
        setBusy(null)
      }
    },
    [busy, router],
  )

  return { busy, error, run }
}
