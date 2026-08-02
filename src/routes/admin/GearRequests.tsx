import { useEffect, useState } from 'react'
import { listSoldiers } from '../../lib/soldiers'
import { listGearRequests, markGearRequestInProgress, resolveGearRequest } from '../../lib/gearRequests'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/errors'
import { notify } from '../../lib/notifications'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { GearRequest, GearRequestCategory, Soldier } from '../../types/database'

const CATEGORY_LABEL: Record<GearRequestCategory, string> = {
  initial_issue: 'Initial Issue (New Soldier)',
  missing_lost: 'Missing / Lost',
  damaged: 'Damaged / Worn Out',
  wrong_size: 'Wrong Size',
  other: 'Other',
}

export function GearRequests() {
  const { session, refreshPendingCounts } = useAuth()
  const [requests, setRequests] = useState<GearRequest[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    setError(null)
    Promise.all([listGearRequests(), listSoldiers()])
      .then(([r, s]) => {
        setRequests(r)
        setSoldiers(s)
        setLoading(false)
      })
      .catch((err) => {
        setError(errorMessage(err, 'Failed to load gear requests'))
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  const soldierLabel = (id: string) => {
    const s = soldiers.find((s) => s.id === id)
    return s ? `${s.rank} ${s.last_name}, ${s.first_name}` : 'Unknown Soldier'
  }

  async function handleStart(request: GearRequest) {
    try {
      await markGearRequestInProgress({ id: request.id })
      const soldier = soldiers.find((s) => s.id === request.soldier_id)
      notify({
        profileId: soldier?.profile_id,
        title: 'Gear request in progress',
        body: CATEGORY_LABEL[request.category],
        link: '/soldier/gear-requests',
      })
      refresh()
      refreshPendingCounts()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update gear request'))
    }
  }

  async function handleResolve(request: GearRequest) {
    if (!session) return
    try {
      await resolveGearRequest({ id: request.id, resolvedBy: session.user.id, notes: resolveDrafts[request.id] ?? '' })
      const soldier = soldiers.find((s) => s.id === request.soldier_id)
      notify({
        profileId: soldier?.profile_id,
        title: 'Gear request resolved',
        body: CATEGORY_LABEL[request.category],
        link: '/soldier/gear-requests',
      })
      refresh()
      refreshPendingCounts()
    } catch (err) {
      setError(errorMessage(err, 'Failed to resolve gear request'))
    }
  }

  if (loading) return <LoadingScreen />

  const open = requests.filter((r) => r.status === 'open')
  const inProgress = requests.filter((r) => r.status === 'in_progress')
  const resolved = requests.filter((r) => r.status === 'resolved')

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-5 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Gear Requests</h1>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">OPEN</h2>
      {open.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">No open gear requests.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {open.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{soldierLabel(r.soldier_id)}</div>
                  <div className="text-xs text-ink-muted">{CATEGORY_LABEL[r.category]}</div>
                  <div className="mt-1 text-xs italic text-ink-dim">&ldquo;{r.description}&rdquo;</div>
                </div>
                <button
                  onClick={() => handleStart(r)}
                  className="flex-shrink-0 rounded-md bg-info-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-info-ink"
                >
                  START WORKING
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Resolution notes (optional to resolve directly)"
                  value={resolveDrafts[r.id] ?? ''}
                  onChange={(e) => setResolveDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleResolve(r)}
                  className="flex-shrink-0 rounded-md bg-good-bg px-3.5 py-2 text-[11px] font-bold tracking-wide text-good-ink"
                >
                  RESOLVE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">IN PROGRESS</h2>
      {inProgress.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">Nothing in progress.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {inProgress.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="mb-2.5">
                <div className="text-sm font-semibold">{soldierLabel(r.soldier_id)}</div>
                <div className="text-xs text-ink-muted">{CATEGORY_LABEL[r.category]}</div>
                <div className="mt-1 text-xs italic text-ink-dim">&ldquo;{r.description}&rdquo;</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Resolution notes"
                  value={resolveDrafts[r.id] ?? ''}
                  onChange={(e) => setResolveDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleResolve(r)}
                  className="flex-shrink-0 rounded-md bg-good-bg px-3.5 py-2 text-[11px] font-bold tracking-wide text-good-ink"
                >
                  RESOLVE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">RESOLVED</h2>
      {resolved.length === 0 ? (
        <p className="text-sm text-ink-muted">No resolved requests yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {resolved.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel p-3.5 opacity-70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{soldierLabel(r.soldier_id)}</div>
                  <div className="text-xs text-ink-muted">{CATEGORY_LABEL[r.category]}</div>
                  {r.resolution_notes && <div className="mt-1 text-xs text-ink-dim">Resolution: {r.resolution_notes}</div>}
                </div>
                <span className="flex-shrink-0 rounded-md bg-good-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-good-ink">
                  RESOLVED
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
