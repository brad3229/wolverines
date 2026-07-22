import { useEffect, useState } from 'react'
import { listSoldiers } from '../../lib/soldiers'
import { listDrillEvents, formatEventDateRange } from '../../lib/drillEvents'
import { listSutaRequests, reviewSutaRequest, markMakeupComplete } from '../../lib/sutaRequests'
import { useAuth } from '../../hooks/useAuth'
import type { DrillEvent, Soldier, SutaRequest } from '../../types/database'

export function Suta() {
  const { session, refreshPendingCounts } = useAuth()
  const [requests, setRequests] = useState<SutaRequest[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [makeupDrafts, setMakeupDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  function refresh() {
    setLoading(true)
    Promise.all([listSutaRequests(), listSoldiers(), listDrillEvents()]).then(([r, s, e]) => {
      setRequests(r)
      setSoldiers(s)
      setEvents(e)
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const soldierLabel = (id: string) => {
    const s = soldiers.find((s) => s.id === id)
    return s ? `${s.rank} ${s.last_name}, ${s.first_name}` : 'Unknown Soldier'
  }
  const eventLabel = (id: string) => {
    const e = events.find((e) => e.id === id)
    return e ? `${e.title} — ${formatEventDateRange(e)}` : 'Unknown event'
  }

  async function handleReview(request: SutaRequest, approve: boolean) {
    if (!session) return
    await reviewSutaRequest({ id: request.id, approve, reviewedBy: session.user.id })
    refresh()
    refreshPendingCounts()
  }

  async function handleMakeupComplete(request: SutaRequest) {
    await markMakeupComplete({ id: request.id, notes: makeupDrafts[request.id] ?? '' })
    refresh()
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading...</p>

  const pendingReview = requests.filter((r) => r.status === 'pending')
  const awaitingMakeup = requests.filter((r) => r.status === 'approved' && r.makeup_status === 'pending')
  const history = requests.filter(
    (r) => r.status === 'denied' || (r.status === 'approved' && r.makeup_status === 'completed'),
  )

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-5 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">SUTA Requests</h1>

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">PENDING REVIEW</h2>
      {pendingReview.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">No pending requests.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {pendingReview.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{soldierLabel(r.soldier_id)}</div>
                  <div className="text-xs text-ink-muted">{eventLabel(r.drill_event_id)}</div>
                  <div className="mt-1 text-xs italic text-ink-dim">&ldquo;{r.reason}&rdquo;</div>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={() => handleReview(r, true)}
                    className="rounded-md bg-good-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-good-ink"
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() => handleReview(r, false)}
                    className="rounded-md bg-bad-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-bad-ink"
                  >
                    DENY
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">AWAITING MAKE-UP</h2>
      {awaitingMakeup.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">Nothing awaiting a make-up.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {awaitingMakeup.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="mb-2.5">
                <div className="text-sm font-semibold">{soldierLabel(r.soldier_id)}</div>
                <div className="text-xs text-ink-muted">Missed: {eventLabel(r.drill_event_id)}</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Make-up notes (e.g. made up at Sept 6 drill)"
                  value={makeupDrafts[r.id] ?? ''}
                  onChange={(e) => setMakeupDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleMakeupComplete(r)}
                  className="flex-shrink-0 rounded-md bg-good-bg px-3.5 py-2 text-[11px] font-bold tracking-wide text-good-ink"
                >
                  MARK COMPLETE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">HISTORY</h2>
      {history.length === 0 ? (
        <p className="text-sm text-ink-muted">No resolved requests yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5 opacity-70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{soldierLabel(r.soldier_id)}</div>
                  <div className="text-xs text-ink-muted">{eventLabel(r.drill_event_id)}</div>
                  {r.makeup_notes && <div className="mt-1 text-xs text-ink-dim">Make-up: {r.makeup_notes}</div>}
                </div>
                <span
                  className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                    r.status === 'denied' ? 'bg-bad-bg text-bad-ink' : 'bg-good-bg text-good-ink'
                  }`}
                >
                  {r.status === 'denied' ? 'DENIED' : 'MAKE-UP COMPLETE'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
