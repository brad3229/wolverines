import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { errorMessage } from '../lib/errors'

interface PasswordRequirement {
  label: string
  met: boolean
}

function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least one letter', met: /[a-zA-Z]/.test(password) },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least one number', met: /[0-9]/.test(password) },
    { label: 'At least one symbol', met: /[^a-zA-Z0-9]/.test(password) },
  ]
}

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const requirements = passwordRequirements(password)
  const requirementsMet = requirements.every((r) => r.met)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!requirementsMet) {
      setError('Password does not meet the requirements above.')
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
          <h1 className="mb-1 font-display text-xl font-semibold tracking-wide">Welcome to ATLAS</h1>
          <p className="text-sm text-ink-muted">Set a password to finish setting up your account</p>
        </div>
        <ul className="mb-4 flex flex-col gap-1">
          {requirements.map((r) => (
            <li
              key={r.label}
              className={`flex items-center gap-1.5 text-[11px] ${r.met ? 'text-good-ink' : 'text-ink-muted'}`}
            >
              <span
                className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full text-[9px] leading-none ${
                  r.met ? 'bg-good-bg' : 'bg-neutral-bg'
                }`}
              >
                {r.met ? '✓' : ''}
              </span>
              {r.label}
            </li>
          ))}
        </ul>
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
          disabled={submitting || !requirementsMet || password !== confirm}
          className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
        >
          {submitting ? 'SAVING...' : 'SET PASSWORD & CONTINUE'}
        </button>
      </form>
    </div>
  )
}
