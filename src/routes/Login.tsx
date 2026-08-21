import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { signInWithPasskey, browserSupportsPasskeys } from '../lib/passkey'
import { errorMessage } from '../lib/errors'
import { initialAuthError } from '../lib/authFlow'
import { IconPasskey } from '../components/icons'

// Minimum time the pre-login splash holds before handing off to the sign-in
// form, so the logo animation always gets to play out even when the auth
// check itself resolves near-instantly (e.g. a cached session).
const SPLASH_MIN_MS = 1500

// Covers expired/already-used invite and password-reset links alike -- Supabase's
// redirect doesn't reliably tell us which flow the link was for, just that it failed.
const AUTH_LINK_ERROR_MESSAGE =
  'That link is invalid or has expired. Ask your unit admin to send you a new invite or password reset.'

export function Login() {
  const { session, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => (initialAuthError ? AUTH_LINK_ERROR_MESSAGE : null))
  const [submitting, setSubmitting] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [splashMinElapsed, setSplashMinElapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS)
    return () => clearTimeout(t)
  }, [])

  // Don't render the form (and its interactive sign-in buttons) until we
  // definitively know whether a session already exists -- otherwise there's
  // a window where the form is live while an existing session is still being
  // checked in the background, and a click can land right as it redirects,
  // making an unrelated stale session look like it came from that click.
  // The same branded splash also covers the minimum hold time below, so the
  // logo animation isn't cut short by a fast auth check.
  if (loading || !splashMinElapsed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-surface">
        <img
          src={`${import.meta.env.BASE_URL}atlas-wordmark-dark.png`}
          alt="ATLAS"
          className="w-72 opacity-0 [animation:logo-pop_0.6s_ease-out_forwards]"
        />
      </div>
    )
  }

  if (session && role) {
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/soldier/dashboard'} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setError(error.message)
  }

  async function handlePasskey() {
    setError(null)
    setPasskeyBusy(true)
    try {
      await signInWithPasskey()
    } catch (err) {
      setError(errorMessage(err, 'Passkey sign-in failed'))
    } finally {
      setPasskeyBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-line bg-panel p-8 opacity-0 [animation:fade-in-up_0.4s_ease-out_forwards]"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={`${import.meta.env.BASE_URL}atlas-wordmark-dark.png`} alt="ATLAS" className="h-9 w-auto" />
        </div>

        {browserSupportsPasskeys() && (
          <>
            <button
              type="button"
              onClick={handlePasskey}
              disabled={passkeyBusy}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent-soft py-2.5 text-sm font-semibold tracking-wide text-accent-soft-ink transition-opacity disabled:opacity-50"
            >
              <IconPasskey className="h-4 w-4" />
              {passkeyBusy ? 'FOLLOW YOUR DEVICE PROMPT...' : 'SIGN IN WITH A PASSKEY'}
            </button>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[11px] text-ink-muted">or sign in with a password</span>
              <div className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">EMAIL</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">PASSWORD</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
        {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
        >
          {submitting ? 'SIGNING IN...' : 'SIGN IN'}
        </button>
      </form>
    </div>
  )
}
