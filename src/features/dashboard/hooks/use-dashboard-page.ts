import { authenticatedRoute } from '@/lib/auth/authenticated-route'

const metadataString = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : null
}

// `user` and `profile` are guaranteed by the `_authenticated` route's guard and loader; this
// hook only resolves what the shell should display.
export const useDashboardPage = () => {
  const { user } = authenticatedRoute.useRouteContext()
  const { profile } = authenticatedRoute.useLoaderData()

  const name =
    profile?.display_name?.trim() || metadataString(user.user_metadata, 'display_name') || 'User'
  const email = profile?.email || user.email || ''
  const avatar =
    metadataString(user.user_metadata, 'avatar_url') ??
    metadataString(user.user_metadata, 'picture') ??
    ''

  return {
    user,
    profile,
    displayUser: { name, email, avatar },
  }
}
