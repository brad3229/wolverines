import { useEffect, useState } from 'react'
import { enrollTotp, verifyFactor, listVerifiedTotpFactor } from '../../lib/mfa'
import { listAdminProfiles } from '../../lib/profiles'
import { resetUserMfa } from '../../lib/adminApi'
import { listSoldiers } from '../../lib/soldiers'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import { CopyButton } from '../../components/CopyButton'
import type { Soldier } from '../../types/database'

export function Security() {
  const { session } = useAuth()
  const [factor, setFactor] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [otherAdminIds, setOtherAdminIds] = useState<string[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [confirmingResetId, setConfirmingResetId] = useState<string | null>(null)
  const [resetSubmittingId, setResetSubmittingId] = useState<string | null>(null)
  const [resetStatus, setResetStatus] = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    setLoadError(null)
    Promise.all([listVerifiedTotpFactor(), listAdminProfiles(), listSoldiers()])
      .then(([f, admins, allSoldiers]) => {
        setFactor(f)
        setOtherAdminIds(admins.map((a) => a.id).filter((id) => id !== session?.user.id))
        setSoldiers(allSoldiers)
      })
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load security settings')))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [session])

  async function startEnroll() {
    setError(null)
    try {
      const enrollment = await enrollTotp()
      setPendingFactorId(enrollment.factorId)
      setQrCode(enrollment.qrCode)
      setSecret(enrollment.secret)
      setUri(enrollment.uri)
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
    setUri(null)
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

  async function handleResetMfa(profileId: string) {
    setResetSubmittingId(profileId)
    setResetStatus(null)
    try {
      await resetUserMfa(profileId)
      setConfirmingResetId(null)
      setResetStatus('MFA cleared. They can re-enroll the next time they sign in.')
    } catch (err) {
      setResetStatus(errorMessage(err, 'Failed to reset MFA'))
    } finally {
      setResetSubmittingId(null)
    }
  }

  function adminLabel(profileId: string) {
    const soldier = soldiers.find((s) => s.profile_id === profileId)
    return soldier ? `${soldier.rank} ${soldier.last_name}, ${soldier.first_name}` : `Admin (${profileId.slice(0, 8)})`
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="mx-auto max-w-[560px]">
      <p className="mb-5 text-[13px] text-ink-muted">
        Two-factor authentication is required for admin accounts using an authenticator app (Google Authenticator,
        Authy, etc).
      </p>

      {loadError && <p className="mb-4 text-sm text-bad-ink">{loadError}</p>}

      {!factor && !enrolling && (
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Two-Factor Authentication</div>
              <div className="text-xs text-ink-muted">Not enabled</div>
            </div>
            <span className="flex-shrink-0 rounded-md bg-bad-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-bad-ink">
              REQUIRED
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
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 text-sm font-semibold">Set up your authenticator app</div>
          {uri && (
            <a
              href={uri}
              className="mb-2 block w-full rounded-md bg-accent-soft py-2.5 text-center text-sm font-semibold tracking-wide text-accent-soft-ink"
            >
              OPEN IN AUTHENTICATOR APP
            </a>
          )}
          <p className="mb-3 text-center text-[11px] text-ink-muted">
            Setting up on this phone? Tap above. On a different device, scan the code below instead.
          </p>
          {qrCode && (
            <div className="mb-3 flex justify-center rounded-lg bg-white p-3">
              <img src={qrCode} alt="TOTP enrollment QR code" className="h-40 w-40" />
            </div>
          )}
          {secret && (
            <div className="mb-3">
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
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Two-Factor Authentication</div>
              <div className="text-xs text-ink-muted">Enabled via authenticator app</div>
            </div>
            <span className="flex-shrink-0 rounded-md bg-good-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-good-ink">
              ON
            </span>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Required for admin accounts, so there&rsquo;s no option to disable it here. Switching devices? Another
            admin can reset it for you below.
          </p>
        </div>
      )}

      {otherAdminIds.length > 0 && (
        <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
          <h2 className="mb-1 font-display text-[15px] font-semibold tracking-wide text-ink-dim">OTHER ADMINS</h2>
          <p className="mb-3 text-xs text-ink-muted">
            If someone loses their authenticator, reset their MFA here so they can enroll a new one next time they
            sign in.
          </p>
          <div className="flex flex-col gap-2">
            {otherAdminIds.map((id) => (
              <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2.5">
                <span className="text-sm font-medium">{adminLabel(id)}</span>
                {confirmingResetId === id ? (
                  <div className="flex gap-2">
                    <button
                      disabled={resetSubmittingId === id}
                      onClick={() => handleResetMfa(id)}
                      className="rounded-md bg-bad-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-bad-ink disabled:opacity-50"
                    >
                      {resetSubmittingId === id ? 'RESETTING...' : 'CONFIRM RESET'}
                    </button>
                    <button
                      onClick={() => setConfirmingResetId(null)}
                      className="rounded-md bg-neutral-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-neutral-ink"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingResetId(id)}
                    className="rounded-md bg-neutral-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-neutral-ink"
                  >
                    RESET MFA
                  </button>
                )}
              </div>
            ))}
          </div>
          {resetStatus && <p className="mt-3 text-sm text-ink-dim">{resetStatus}</p>}
        </div>
      )}
    </div>
  )
}
