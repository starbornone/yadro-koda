import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getMyProfile, upsertProfileFromUser } from './lib/supabase/profiles'
import { supabase } from './lib/supabase/supabase'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getMyProfile>>>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const nextProfile = await getMyProfile()
        if (active) {
          setProfile(nextProfile)
        }
      } catch (loadError) {
        if (active && loadError instanceof Error) {
          setError(loadError.message)
        }
      }
    }

    const syncProfile = async (nextSession: Session | null) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
        return
      }

      const { error: upsertError } = await upsertProfileFromUser(nextSession.user)
      if (upsertError && active) {
        setError(upsertError.message)
        return
      }

      await loadProfile()
    }

    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      await syncProfile(currentSession)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncProfile(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const user = session?.user

  const profileRows = useMemo(
    () => [
      ['uid', user?.id ?? '-'],
      ['display name', profile?.display_name ?? user?.user_metadata?.display_name ?? '-'],
      ['email', profile?.email ?? user?.email ?? '-'],
      ['phone', profile?.phone ?? user?.phone ?? '-'],
      [
        'providers',
        profile?.providers?.join(', ') ||
        (Array.isArray(user?.app_metadata?.providers)
          ? user.app_metadata.providers.join(', ')
          : '-') ||
        '-',
      ],
      ['provider type', profile?.provider ?? user?.app_metadata?.provider ?? '-'],
      [
        'created at',
        profile?.created_at
          ? new Date(profile.created_at).toLocaleString()
          : user?.created_at
            ? new Date(user.created_at).toLocaleString()
            : '-',
      ],
      [
        'last sign in at',
        profile?.last_sign_in_at
          ? new Date(profile.last_sign_in_at).toLocaleString()
          : user?.last_sign_in_at
            ? new Date(user.last_sign_in_at).toLocaleString()
            : '-',
      ],
    ],
    [profile, user],
  )

  const resetFeedback = () => {
    setError(null)
    setMessage(null)
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    resetFeedback()
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }

    setMessage('Signed in.')
  }

  const handleSignUp = async () => {
    if (loading) return
    resetFeedback()
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim() || undefined,
        },
      },
    })

    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.user && !data.session) {
      const { error: profileError } = await upsertProfileFromUser(data.user, displayName)
      if (profileError) {
        setError(profileError.message)
        return
      }

      setMessage('Check your email to confirm your account.')
      return
    }

    if (data.user) {
      const { error: profileError } = await upsertProfileFromUser(data.user, displayName)
      if (profileError) {
        setError(profileError.message)
        return
      }
    }

    setMessage('Account created and signed in.')
  }

  const handleSignOut = async () => {
    if (loading) return
    resetFeedback()
    setLoading(true)
    const { error: signOutError } = await supabase.auth.signOut()
    setLoading(false)

    if (signOutError) {
      setError(signOutError.message)
      return
    }

    setMessage('Signed out.')
  }

  return (
    <main className="auth-page">
      <section className="card">
        <h1>Supabase Auth</h1>
        {!user ? (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label>
              Display name (optional)
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                maxLength={100}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                minLength={6}
                required
              />
            </label>
            <div className="actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Working...' : 'Sign in'}
              </button>
              <button type="button" onClick={handleSignUp} disabled={loading}>
                {loading ? 'Working...' : 'Sign up'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="signed-in">Signed in as {user.email ?? user.id}</p>
            <div className="actions">
              <button type="button" onClick={handleSignOut} disabled={loading}>
                {loading ? 'Working...' : 'Sign out'}
              </button>
            </div>
            <dl className="profile">
              {profileRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {error && <p className="feedback error">{error}</p>}
        {message && <p className="feedback success">{message}</p>}
      </section>
    </main>
  )
}

export default App
