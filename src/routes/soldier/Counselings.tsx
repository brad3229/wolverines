import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listCounselingsForSoldier, acknowledgeCounseling } from '../../lib/counselings'
import { formatDate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { Counseling, Soldier } from '../../types/database'

export function Counselings() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [counselings, setCounselings] = useState<Counseling[]>([])
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ackTarget, setAckTarget] = useState<Counseling | null>(null)
  const [ackChoice, setAckChoice] = useState<'agree' | 'disagree' | null>(null)
  const [ackRemarks, setAckRemarks] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setNotLinked(false)
    setError(null)
    getOwnSoldierRecord(session.user.id)
      .then((s) => {
        setSoldier(s)
        listCounselingsForSoldier(s.id)
          .then(setCounselings)
          .catch((err) => setError(errorMessage(err, 'Failed to load counselings')))
          .finally(() => setLoading(false))
      })
      .catch(() => {
        setNotLinked(true)
        setLoading(false)
      })
  }, [session])

  async function handlePreview(counseling: Counseling) {
    if (!soldier) return
    try {
      const { fillInitialCounseling, previewPdf } = await import('../../lib/pdfForms')
      const bytes = await fillInitialCounseling(soldier, counseling)
      previewPdf(bytes)
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate form'))
    }
  }

  function openAck(counseling: Counseling) {
    setAckTarget(counseling)
    setAckChoice(null)
    setAckRemarks('')
    setSignatureName('')
    setAckError(null)
  }

  async function handleConfirmAck() {
    if (!ackTarget || !ackChoice || !signatureName.trim()) return
    setSubmitting(true)
    setAckError(null)
    try {
      const updated = await acknowledgeCounseling({
        id: ackTarget.id,
        acknowledgment: ackChoice,
        individualRemarks: ackRemarks.trim() || null,
        signatureName: signatureName.trim(),
      })
      setCounselings((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setAckTarget(null)
    } catch (err) {
      setAckError(errorMessage(err, 'Failed to sign counseling'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen />

  if (notLinked || !soldier) {
    return (
      <div className="mx-auto max-w-[640px]">
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so there&rsquo;s no counseling history to
          show.{' '}
          {role === 'admin'
            ? 'Add yourself to the Roster and link your account to it, or have another admin do it.'
            : 'Ask an admin to add you to the Roster and link your account to it.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <p className="mb-5 text-[13px] text-ink-muted">
        Your developmental counselings, recorded by cadre. Review and sign any that need your acknowledgment below.
      </p>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      {counselings.length === 0 ? (
        <p className="text-sm text-ink-muted">No counselings on record yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {counselings.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {formatDate(c.session_date)} — {c.purpose}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">{c.counselor_name}</div>
                </div>
                <button
                  onClick={() => handlePreview(c)}
                  className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                >
                  PREVIEW FORM
                </button>
              </div>

              {c.acknowledgment ? (
                <div
                  className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    c.acknowledgment === 'agree'
                      ? 'border-good-border bg-good-bg text-good-ink'
                      : 'border-warn-border bg-warn-bg text-warn-ink'
                  }`}
                >
                  <span className="font-bold tracking-wide">
                    {c.acknowledgment === 'agree' ? 'YOU AGREED' : 'YOU DISAGREED'}
                  </span>
                  <span className="text-ink-muted">
                    &middot; signed {c.acknowledged_at ? formatDate(c.acknowledged_at.slice(0, 10)) : ''}
                  </span>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn-border bg-warn-bg/40 px-3 py-2">
                  <span className="text-xs text-warn-ink">This counseling needs your review and signature.</span>
                  <button
                    onClick={() => openAck(c)}
                    className="flex-shrink-0 rounded-md bg-accent px-2.5 py-1 text-[10px] font-bold tracking-wide text-accent-ink"
                  >
                    REVIEW & SIGN
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ackTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setAckTarget(null)}>
          <div
            className="flex w-full max-w-md max-h-[85vh] flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-lg sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">
              Sign counseling — {formatDate(ackTarget.session_date)} — {ackTarget.purpose}
            </div>
            <button
              onClick={() => handlePreview(ackTarget)}
              className="self-start rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
            >
              PREVIEW FORM FIRST
            </button>

            <div>
              <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
                DO YOU AGREE WITH THE INFORMATION ABOVE?
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAckChoice('agree')}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold tracking-wide ${
                    ackChoice === 'agree' ? 'border-good-border bg-good-bg text-good-ink' : 'border-line bg-surface text-ink-dim'
                  }`}
                >
                  I AGREE
                </button>
                <button
                  onClick={() => setAckChoice('disagree')}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold tracking-wide ${
                    ackChoice === 'disagree' ? 'border-warn-border bg-warn-bg text-warn-ink' : 'border-line bg-surface text-ink-dim'
                  }`}
                >
                  I DISAGREE
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">REMARKS (OPTIONAL)</label>
              <textarea
                value={ackRemarks}
                onChange={(e) => setAckRemarks(e.target.value)}
                className="min-h-[80px] w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">TYPE YOUR NAME TO SIGN</label>
              <input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-muted">This is stamped onto the form as your signature.</p>
            </div>

            {ackError && <p className="text-sm text-bad-ink">{ackError}</p>}
            <div className="flex gap-2">
              <button
                disabled={submitting || !ackChoice || !signatureName.trim()}
                onClick={handleConfirmAck}
                className="rounded-md bg-accent px-3.5 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
              >
                {submitting ? 'SIGNING...' : 'SUBMIT SIGNATURE'}
              </button>
              <button
                onClick={() => setAckTarget(null)}
                className="rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
