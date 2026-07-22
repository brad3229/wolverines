import { useEffect, useState } from 'react'
import { listDrillEvents, formatEventDateRange, EVENT_TYPE_LABEL } from '../../lib/drillEvents'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listOwnSutaRequests, submitSutaRequest } from '../../lib/sutaRequests'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import type { DrillEvent, MakeupStatus, Soldier, SutaRequest, SutaStatus } from '../../types/database'

const STATUS_BADGE: Record<SutaStatus, { label: string; className: string }> = {
  pending: { label: 'PENDING', className: 'bg-warn-bg text-warn-ink' },
  approved: { label: 'APPROVED', className: 'bg-good-bg text-good-ink' },
  denied: { label: 'DENIED', className: 'bg-bad-bg text-bad-ink' },
}

const MAKEUP_BADGE: Record<MakeupStatus, { label: string; className: string } | null> = {
  not_required: null,
  pending: { label: 'MAKE-UP PENDING', className: 'bg-warn-bg text-warn-ink' },
  completed: { label: 'MAKE-UP COMPLETE', className: 'bg-good-bg text-good-ink' },
}

export function Suta() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [requests, setRequests] = useState<SutaRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [eventId, setEventId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)

  async function refresh() {
    if (!session) return
    setLoading(true)
    setNotLinked(false)
    try {
      const [s, e] = await Promise.all([getOwnSoldierRecord(session.user.id), listDrillEvents()])
      setSoldier(s)
      setEvents(e)
      setRequests(await listOwnSutaRequests(s.id))
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

  if (loading) return <p className="text-sm text-ink-muted">Loading...</p>

  if (notLinked || !soldier) {
    return (
      <div className="mx-auto max-w-[560px]">
        <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:mb-5 sm:text-[26px]">
          SUTA
        </h1>
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so you can&rsquo;t submit a SUTA
          request.{' '}
          {role === 'admin'
            ? 'Add yourself to the Roster and link your account to it, or have another admin do it.'
            : 'Ask an admin to add you to the Roster and link your account to it.'}
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const requestedEventIds = new Set(requests.map((r) => r.drill_event_id))
  const eligibleEvents = events.filter((e) => e.end_date >= today && !requestedEventIds.has(e.id))
  const eventLabel = (id: string) => {
    const e = events.find((e) => e.id === id)
    return e ? `${e.title} — ${formatEventDateRange(e)}` : 'Unknown event'
  }

  async function handleSubmit() {
    if (!soldier || !eventId || !reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await submitSutaRequest({ soldierId: soldier.id, drillEventId: eventId, reason: reason.trim() })
      setShowForm(false)
      setEventId('')
      setReason('')
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">SUTA</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showForm ? 'CANCEL' : '+ NEW REQUEST'}
        </button>
      </div>
      <p className="mb-5 text-[13px] text-ink-muted">
        Can't make a drill or Annual Training? Submit a request explaining why — your chain of command will review it.
        Approved requests still require a make-up.
      </p>

      {showForm && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">EVENT</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Select event
              </option>
              {eligibleEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({EVENT_TYPE_LABEL[e.event_type]}) — {formatEventDateRange(e)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">REASON</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you can't attend"
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-bad-ink">{error}</p>}
          <div>
            <button
              disabled={submitting || !eventId || !reason.trim()}
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
        <p className="text-sm text-ink-muted">No SUTA requests yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const makeupBadge = MAKEUP_BADGE[r.makeup_status]
            return (
              <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-[180px] flex-1">
                    <div className="text-sm font-semibold">{eventLabel(r.drill_event_id)}</div>
                    <div className="mt-0.5 text-xs italic text-ink-muted">&ldquo;{r.reason}&rdquo;</div>
                    {r.makeup_status === 'completed' && r.makeup_notes && (
                      <div className="mt-1 text-xs text-ink-dim">Make-up: {r.makeup_notes}</div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${STATUS_BADGE[r.status].className}`}
                    >
                      {STATUS_BADGE[r.status].label}
                    </span>
                    {makeupBadge && (
                      <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${makeupBadge.className}`}>
                        {makeupBadge.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
