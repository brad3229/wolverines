import { useState } from 'react'
import { enrollTotp, enrollPasskey, verifyFactor, browserSupportsPasskeys } from '../lib/mfa'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { CopyButton } from './CopyButton'

type Method = 'choose' | 'totp'

// Blocks the whole app for an admin account with no verified MFA factor --
// MFA is mandatory for admin (see migration 20260808000000), so there's no
// "skip for now" here the way a Soldier's optional setup on the Security
// page has one. Passkey is offered first since it's one tap (Face ID/Touch
// ID/Windows Hello) with no app-switching; TOTP enrollment only starts if the
// admin picks it, so no factor gets created until they've chosen a method.
export function MfaEnrollmentRequired() {
  const { refreshMfaStatus } = useAuth()
  const [method, setMethod] = useState<Method>('choose')
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [totpError, setTotpError] = useState<string | null>(null)
  const [totpStarting, setTotpStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function startPasskey() {
    setPasskeyBusy(true)
    setPasskeyError(null)
    try {
      await enrollPasskey('Passkey')
      refreshMfaStatus()
    } catch (err) {
      setPasskeyError(errorMessage(err, 'Failed to set up passkey'))
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function startTotp() {
    setMethod('totp')
    setTotpStarting(true)
    setTotpError(null)
    try {
      const enrollment = await enrollTotp()
      setPendingFactorId(enrollment.factorId)
      setQrCode(enrollment.qrCode)
      setSecret(enrollment.secret)
      setUri(enrollment.uri)
    } catch (err) {
      setTotpError(errorMessage(err, 'Failed to start enrollment'))
    } finally {
      setTotpStarting(false)
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingFactorId) return
    setSubmitting(true)
    setTotpError(null)
    try {
      await verifyFactor(pendingFactorId, code)
      refreshMfaStatus()
    } catch (err) {
      setTotpError(errorMessage(err, 'Invalid code'))
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
          <p className="text-sm text-ink-muted">Admin accounts require a second sign-in step. This only takes a minute.</p>
        </div>

        {method === 'choose' && (
          <>
            {browserSupportsPasskeys() && (
              <>
                <button
                  type="button"
                  onClick={startPasskey}
                  disabled={passkeyBusy}
                  className="mb-2 w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
                >
                  {passkeyBusy ? 'FOLLOW YOUR DEVICE PROMPT...' : 'USE FACE ID / TOUCH ID / PASSKEY'}
                </button>
                {passkeyError && <p className="mb-3 text-sm text-bad-ink">{passkeyError}</p>}
              </>
            )}
            <button
              type="button"
              onClick={startTotp}
              className="mb-3 w-full text-center text-xs text-ink-muted underline"
            >
              Use an authenticator app instead
            </button>
          </>
        )}

        {method === 'totp' && (
          totpStarting ? (
            <p className="text-center text-sm text-ink-muted">Preparing enrollment...</p>
          ) : (
            <form onSubmit={handleTotpSubmit}>
              {secret && (
                <div className="mb-2">
                  <p className="mb-1 text-center text-xs text-ink-muted">
                    Setting up on this phone? Copy this key, then in your authenticator app choose &ldquo;Enter a
                    setup key manually&rdquo; and paste it in:
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                    <span className="min-w-0 break-all font-mono text-xs text-ink-dim">{secret}</span>
                    <CopyButton value={secret} />
                  </div>
                </div>
              )}
              {uri && (
                <a href={uri} className="mb-4 block text-center text-[11px] text-ink-muted underline">
                  Or try opening directly in your app (works with some apps, e.g. 1Password)
                </a>
              )}
              <p className="mb-2 text-center text-[11px] text-ink-muted">On a different device, scan this instead:</p>
              {qrCode && (
                <div className="mb-4">
                  <div className="flex justify-center rounded-lg bg-white p-3">
                    <img src={qrCode} alt="TOTP enrollment QR code" className="h-40 w-40" />
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
              {totpError && <p className="mb-4 text-sm text-bad-ink">{totpError}</p>}
              <button
                type="submit"
                disabled={submitting || code.length !== 6 || !pendingFactorId}
                className="mb-2 w-full rounded-md bg-accent py-2.5 text-sm font-semibold tracking-wide text-accent-ink transition-opacity disabled:opacity-50"
              >
                {submitting ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
              </button>
              {browserSupportsPasskeys() && (
                <button
                  type="button"
                  onClick={() => setMethod('choose')}
                  className="mb-3 w-full text-center text-xs text-ink-muted underline"
                >
                  Back
                </button>
              )}
            </form>
          )
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
