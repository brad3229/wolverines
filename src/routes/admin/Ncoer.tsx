import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { getExpiringSoldiers } from '../../lib/expirations'
import { formatDate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { BackButton } from '../../components/BackButton'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { Soldier } from '../../types/database'

export function Ncoer() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSoldiers()
      .then(setSoldiers)
      .catch((err) => setError(errorMessage(err, 'Failed to load roster')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />

  const ncoerSoldiers = getExpiringSoldiers(soldiers)
    .filter((s) => s.ncoerFlag !== null)
    .sort((a, b) => (a.ncoerDays ?? 0) - (b.ncoerDays ?? 0))
  const overdue = ncoerSoldiers.filter((s) => s.ncoerFlag === 'expired')
  const upcoming = ncoerSoldiers.filter((s) => s.ncoerFlag === 'soon')

  return (
    <div className="mx-auto max-w-[760px]">
      <BackButton to="/admin/dashboard" label="Back to dashboard" />
      <h1 className="mb-5 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">NCOER Tracker</h1>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">OVERDUE</h2>
      {overdue.length === 0 ? (
        <p className="mb-7 text-sm text-ink-muted">No overdue NCOERs.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {overdue.map(({ soldier, ncoerDays }) => (
            <Link
              key={soldier.id}
              to={`/admin/roster/${soldier.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel p-3.5 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {soldier.rank} {soldier.last_name}, {soldier.first_name}
                </div>
                <div className="text-xs text-ink-muted">
                  Last NCOER: {soldier.last_ncoer_date ? formatDate(soldier.last_ncoer_date) : '—'}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-md bg-bad-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-bad-ink">
                {Math.abs(ncoerDays!)}D OVERDUE
              </span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">UPCOMING</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-muted">No NCOERs due soon.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {upcoming.map(({ soldier, ncoerDays }) => (
            <Link
              key={soldier.id}
              to={`/admin/roster/${soldier.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel p-3.5 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {soldier.rank} {soldier.last_name}, {soldier.first_name}
                </div>
                <div className="text-xs text-ink-muted">
                  Last NCOER: {soldier.last_ncoer_date ? formatDate(soldier.last_ncoer_date) : '—'}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-md bg-warn-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-warn-ink">
                DUE IN {ncoerDays}D
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
