import { useState } from 'react'
import { verifyFactor } from '../lib/mfa'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'

export function MfaChallenge() {
  const { mfaFactorId, clearMfaChallenge } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaFactorId) return
    setSubmitting(true)
    setError(null)
    try {
      await verifyFactor(mfaFactorId, code)
      clearMfaChallenge()
    } catch (err) {
      setError(errorMessage(err, 'Invalid code'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-line bg-panel p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent font-display text-base font-bold text-accent-ink">
            2FA
          </div>
          <h1 className="font-display text-xl font-semibold tracking-wide">Verification Required</h1>
          <p className="text-sm text-ink-muted">Enter the 6-digit code from your authenticator app</p>
        </div>
        <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">CODE</label>
        <input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-center text-lg tracking-[0.3em] text-ink focus:border-accent focus:outline-none"
        />
        {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}
        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="mb-3 w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
        >
          {submitting ? 'VERIFYING...' : 'VERIFY'}
        </button>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full text-center text-xs text-ink-muted hover:text-ink-dim"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
