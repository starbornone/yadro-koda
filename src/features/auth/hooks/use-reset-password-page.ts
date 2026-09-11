import { useAuth } from '@/lib/auth/auth-store'
import { usePasswordUpdate } from './use-password-update'

// On success Supabase emits USER_UPDATED, which clears the store's recovery flag; the guards
// then let the user into the app, and the page offers a link to the dashboard.
export const useResetPasswordPage = () => {
  const auth = useAuth()
  const { handleSubmit, ...passwordUpdate } = usePasswordUpdate()

  return {
    email: auth.user?.email ?? '',
    ...passwordUpdate,
    handleReset: handleSubmit,
  }
}
