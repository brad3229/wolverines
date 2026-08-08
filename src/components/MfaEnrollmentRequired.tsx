import { useEffect, useState } from 'react'
import { enrollTotp, verifyFactor } from '../lib/mfa'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { CopyButton } from './CopyButton'

// Blocks the whole app for an admin account with no verified MFA factor --
// MFA is mandatory for admin (see migration 20260808000000), so there's no
// "skip for now" here the way a Soldier's optional setup on the Security
// page has one. Verifying the code elevates the session to aal2 immediately;
// refreshMfaStatus() re-checks so this gate drops as soon as that happens.
export function MfaEnrollmentRequired() {
  const { refreshMfaStatus } = useAuth()
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // StrictMode double-invokes this effect in dev, firing two concurrent
    // enrollTotp() calls -- the first creates a factor and succeeds, the
    // second sees it mid-flight and fails with a "factor already exists"
    // error. `active` drops that stale second result instead of letting it
    // clobber the first call's valid QR code with a spurious error.
    let active = true
    enrollTotp()
      .then((enrollment) => {
        if (!active) return
        setPendingFactorId(enrollment.factorId)
        setQrCode(enrollment.qrCode)
        setSecret(enrollment.secret)
        setUri(enrollment.uri)
      })
      .catch((err) => {
        if (!active) return
        setError(errorMessage(err, 'Failed to start enrollment'))
      })
      .finally(() => {
        if (active) setStarting(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingFactorId) return
    setSubmitting(true)
    setError(null)
    try {
      await verifyFactor(pendingFactorId, code)
      refreshMfaStatus()
    } catch (err) {
      setError(errorMessage(err, 'Invalid code'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent font-display text-base font-bold text-accent-ink">
            2FA
          </div>
          <h1 className="font-display text-xl font-semibold tracking-wide">Set Up Two-Factor Authentication</h1>
          <p className="text-sm text-ink-muted">
            Admin accounts require an authenticator app (Google Authenticator, Authy, etc). This only takes a minute.
          </p>
        </div>

        {starting ? (
          <p className="text-center text-sm text-ink-muted">Preparing enrollment...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {uri && (
              <a
                href={uri}
                className="mb-2 block w-full rounded-md bg-accent-soft py-2.5 text-center text-sm font-semibold tracking-wide text-accent-ink"
              >
                OPEN IN AUTHENTICATOR APP
              </a>
            )}
            <p className="mb-4 text-center text-[11px] text-ink-muted">
              Setting up on this phone? Tap above. On a different device, scan the code below instead.
            </p>
            {qrCode && (
              <div className="mb-3 flex justify-center rounded-lg bg-white p-3">
                <img src={qrCode} alt="TOTP enrollment QR code" className="h-40 w-40" />
              </div>
            )}
            {secret && (
              <div className="mb-4">
                <p className="mb-1 text-center text-xs text-ink-muted">Or enter this setup key manually in your app:</p>
                <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                  <span className="min-w-0 break-all font-mono text-xs text-ink-dim">{secret}</span>
                  <CopyButton value={secret} />
                </div>
              </div>
            )}
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
              ENTER THE 6-DIGIT CODE FROM YOUR APP
            </label>
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
              disabled={submitting || code.length !== 6 || !pendingFactorId}
              className="mb-3 w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
            >
              {submitting ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full text-center text-xs text-ink-muted hover:text-ink-dim"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
