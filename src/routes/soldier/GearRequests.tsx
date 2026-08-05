import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listOwnGearRequests, submitGearRequest, GEAR_CATEGORY_LABEL as CATEGORY_LABEL } from '../../lib/gearRequests'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { GearRequest, GearRequestCategory, GearRequestStatus, Soldier } from '../../types/database'

const STATUS_BADGE: Record<GearRequestStatus, { label: string; className: string }> = {
  open: { label: 'OPEN', className: 'bg-warn-bg text-warn-ink' },
  in_progress: { label: 'IN PROGRESS', className: 'bg-info-bg text-info-ink' },
  resolved: { label: 'RESOLVED', className: 'bg-good-bg text-good-ink' },
}

export function GearRequests() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [requests, setRequests] = useState<GearRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState<GearRequestCategory>('initial_issue')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)

  async function refresh() {
    if (!session) return
    setLoading(true)
    setNotLinked(false)
    try {
      const s = await getOwnSoldierRecord(session.user.id)
      setSoldier(s)
      setRequests(await listOwnGearRequests(s.id))
    } catch {
      setNotLinked(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  if (loading) return <LoadingScreen />

  if (notLinked || !soldier) {
    return (
      <div className="mx-auto max-w-[560px]">
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so you can&rsquo;t submit a gear
          request.{' '}
          {role === 'admin'
            ? 'Add yourself to the Roster and link your account to it, or have another admin do it.'
            : 'Ask an admin to add you to the Roster and link your account to it.'}
        </div>
      </div>
    )
  }

  async function handleDownload(request: GearRequest) {
    if (!soldier) return
    try {
      const { fillCcdfOrderForm, downloadPdf } = await import('../../lib/pdfForms')
      const bytes = await fillCcdfOrderForm(soldier, request)
      downloadPdf(bytes, `CCDF-${soldier.last_name}-${soldier.first_name}.pdf`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate form'))
    }
  }

  async function handleSubmit() {
    if (!soldier || !description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await submitGearRequest({ soldierId: soldier.id, category, description: description.trim() })
      setShowForm(false)
      setCategory('initial_issue')
      setDescription('')
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4 flex justify-end sm:mb-5">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showForm ? 'CANCEL' : '+ REQUEST GEAR'}
        </button>
      </div>
      <p className="mb-5 text-[13px] text-ink-muted">
        New to the unit and need your initial issue, or missing/damaged something? Report it here and your chain of
        command will follow up.
      </p>

      {showForm && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">CATEGORY</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GearRequestCategory)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {(Object.keys(CATEGORY_LABEL) as GearRequestCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">DESCRIPTION</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What gear do you need? (e.g. ACH helmet, size L IOTV, sleeping bag)"
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-bad-ink">{error}</p>}
          <div>
            <button
              disabled={submitting || !description.trim()}
              onClick={handleSubmit}
              className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
            >
              {submitting ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">MY REQUESTS</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-ink-muted">No gear requests reported yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold">{CATEGORY_LABEL[r.category]}</div>
                  <div className="mt-0.5 text-xs italic text-ink-muted">&ldquo;{r.description}&rdquo;</div>
                  {r.status === 'resolved' && r.resolution_notes && (
                    <div className="mt-1 text-xs text-ink-dim">Resolution: {r.resolution_notes}</div>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleDownload(r)}
                    className="rounded-md bg-neutral-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-neutral-ink"
                  >
                    DOWNLOAD FORM
                  </button>
                  <span
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${STATUS_BADGE[r.status].className}`}
                  >
                    {STATUS_BADGE[r.status].label}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
