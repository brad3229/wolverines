import { useEffect, useState } from 'react'
import { enrollTotp, verifyFactor, unenrollTotp, listVerifiedTotpFactor } from '../../lib/mfa'
import { errorMessage } from '../../lib/errors'

export function Security() {
  const [factor, setFactor] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDisable, setConfirmingDisable] = useState(false)

  function refresh() {
    setLoading(true)
    listVerifiedTotpFactor()
      .then(setFactor)
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  async function startEnroll() {
    setError(null)
    try {
      const enrollment = await enrollTotp()
      setPendingFactorId(enrollment.factorId)
      setQrCode(enrollment.qrCode)
      setSecret(enrollment.secret)
      setEnrolling(true)
    } catch (err) {
      setError(errorMessage(err, 'Failed to start enrollment'))
    }
  }

  function cancelEnroll() {
    setEnrolling(false)
    setPendingFactorId(null)
    setQrCode(null)
    setSecret(null)
    setCode('')
    setError(null)
  }

  async function confirmEnroll() {
    if (!pendingFactorId) return
    setSubmitting(true)
    setError(null)
    try {
      await verifyFactor(pendingFactorId, code)
      cancelEnroll()
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Invalid code'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDisable() {
    if (!factor) return
    setSubmitting(true)
    setError(null)
    try {
      await unenrollTotp(factor.id)
      setConfirmingDisable(false)
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Failed to disable'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading...</p>

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="mb-1 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Security</h1>
      <p className="mb-5 text-[13px] text-ink-muted">
        Add two-factor authentication to your admin account using an authenticator app (Google Authenticator, Authy,
        etc).
      </p>

      {!factor && !enrolling && (
        <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Two-Factor Authentication</div>
              <div className="text-xs text-ink-muted">Not enabled</div>
            </div>
            <span className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink">
              OFF
            </span>
          </div>
          <button
            onClick={startEnroll}
            className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
          >
            ENABLE 2FA
          </button>
          {error && <p className="mt-3 text-sm text-bad-ink">{error}</p>}
        </div>
      )}

      {enrolling && (
        <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 text-sm font-semibold">Scan this QR code</div>
          {qrCode && (
            <div className="mb-3 flex justify-center rounded-lg bg-white p-3">
              <img src={qrCode} alt="TOTP enrollment QR code" className="h-40 w-40" />
            </div>
          )}
          {secret && (
            <p className="mb-3 break-all text-center text-xs text-ink-muted">
              Can&rsquo;t scan? Enter this code manually: <span className="font-mono text-ink-dim">{secret}</span>
            </p>
          )}
          <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
            ENTER THE 6-DIGIT CODE FROM YOUR APP
          </label>
          <input
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-center text-lg tracking-[0.3em] text-ink focus:border-accent focus:outline-none"
          />
          {error && <p className="mb-3 text-sm text-bad-ink">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={submitting || code.length !== 6}
              onClick={confirmEnroll}
              className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
            >
              {submitting ? 'VERIFYING...' : 'CONFIRM'}
            </button>
            <button
              onClick={cancelEnroll}
              className="rounded-md bg-neutral-bg px-4 py-2 text-xs font-bold tracking-wide text-neutral-ink"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {factor && (
        <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Two-Factor Authentication</div>
              <div className="text-xs text-ink-muted">Enabled via authenticator app</div>
            </div>
            <span className="flex-shrink-0 rounded-md bg-good-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-good-ink">
              ON
            </span>
          </div>
          {!confirmingDisable ? (
            <button
              onClick={() => setConfirmingDisable(true)}
              className="rounded-md bg-neutral-bg px-4 py-2 text-xs font-bold tracking-wide text-neutral-ink"
            >
              DISABLE 2FA
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-warn-ink">
                Disabling 2FA makes your account easier to compromise. Are you sure?
              </p>
              <div className="flex gap-2">
                <button
                  disabled={submitting}
                  onClick={handleDisable}
                  className="rounded-md bg-bad-bg px-4 py-2 text-xs font-bold tracking-wide text-bad-ink disabled:opacity-50"
                >
                  {submitting ? 'DISABLING...' : 'CONFIRM DISABLE'}
                </button>
                <button
                  onClick={() => setConfirmingDisable(false)}
                  className="rounded-md bg-neutral-bg px-4 py-2 text-xs font-bold tracking-wide text-neutral-ink"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-bad-ink">{error}</p>}
        </div>
      )}
    </div>
  )
}
