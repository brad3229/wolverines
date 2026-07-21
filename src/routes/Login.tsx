import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { session, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session && role) {
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

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-surface bg-cover bg-center px-4 py-10"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}greentopobackground.jpg)` }}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-line bg-panel p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 min-w-12 items-center justify-center rounded-lg bg-accent px-2 font-display text-base font-bold text-accent-ink">
            ACO
          </div>
          <h1 className="font-display text-xl font-semibold tracking-wide">A CO 1-120 IN</h1>
          <p className="text-sm text-ink-muted">Sign in to your unit account</p>
        </div>
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
