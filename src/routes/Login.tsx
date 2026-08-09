import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { signInWithPasskey, browserSupportsPasskeys } from '../lib/passkey'
import { errorMessage } from '../lib/errors'
import { LoadingScreen } from '../components/LoadingScreen'

export function Login() {
  const { session, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)

  // Don't render the form (and its interactive sign-in buttons) until we
  // definitively know whether a session already exists -- otherwise there's
  // a window where the form is live while an existing session is still being
  // checked in the background, and a click can land right as it redirects,
  // making an unrelated stale session look like it came from that click.
  if (loading) {
    return <LoadingScreen />
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
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-line bg-panel p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 min-w-12 items-center justify-center rounded-lg bg-accent px-2 font-display text-base font-bold text-accent-ink">
            AT
          </div>
          <h1 className="font-display text-xl font-semibold tracking-wide">ATLAS</h1>
          <p className="text-sm text-ink-muted">A CO 1-120 IN</p>
        </div>

        {browserSupportsPasskeys() && (
          <>
            <button
              type="button"
              onClick={handlePasskey}
              disabled={passkeyBusy}
              className="mb-4 w-full rounded-md bg-accent-soft py-2.5 text-sm font-semibold tracking-wide text-accent-soft-ink transition-opacity disabled:opacity-50"
            >
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
