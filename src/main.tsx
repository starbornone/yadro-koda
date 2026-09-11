import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { syncRouterWithAuth } from '@/lib/auth/sync-router-with-auth'
import { router } from './router'

syncRouterWithAuth(router)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
