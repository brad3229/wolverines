import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { errorMessage } from '../lib/errors'

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) {
      setError(errorMessage(error, 'Failed to set password'))
      return
    }
    onDone()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-line bg-panel p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent font-display text-base font-bold text-accent-ink">
            ACO
          </div>
          <h1 className="font-display text-xl font-semibold tracking-wide">Welcome</h1>
          <p className="text-sm text-ink-muted">Set a password to finish setting up your account</p>
        </div>
        <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">NEW PASSWORD</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">CONFIRM PASSWORD</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
        {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
        >
          {submitting ? 'SAVING...' : 'SET PASSWORD & CONTINUE'}
        </button>
      </form>
    </div>
  )
}
