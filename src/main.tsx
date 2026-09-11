import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { authStore } from '@/lib/auth/auth-store'
import { router } from './router'

// Re-run route guards whenever the signed-in user changes (sign-in, sign-out, session expiry,
// another tab). `beforeLoad` redirects take it from there, so pages never navigate themselves.
void authStore.ready().then(() => {
  let userId = authStore.getSnapshot().user?.id ?? null

  authStore.subscribe(() => {
    const nextUserId = authStore.getSnapshot().user?.id ?? null
    if (nextUserId === userId) return

    userId = nextUserId
    void router.invalidate()
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
