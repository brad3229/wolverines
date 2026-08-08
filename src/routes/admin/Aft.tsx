import { useEffect, useState } from 'react'
import { listSoldiers } from '../../lib/soldiers'
import { listAftTests, aftFlag, AFT_RESULT_LABEL } from '../../lib/aft'
import { formatDate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { BackButton } from '../../components/BackButton'
import { LoadingScreen } from '../../components/LoadingScreen'
import { AftScoreModal } from '../../components/AftScoreModal'
import type { AftTest, Soldier } from '../../types/database'

export function Aft() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [tests, setTests] = useState<AftTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalSoldier, setModalSoldier] = useState<Soldier | null>(null)

  function refresh() {
    Promise.all([listSoldiers(), listAftTests()])
      .then(([s, t]) => {
        setSoldiers(s)
        setTests(t)
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load AFT data')))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  if (loading) return <LoadingScreen />

  // listAftTests() is already sorted newest-first, so the first match per
  // soldier is their latest test.
  const latestBySoldier = new Map<string, AftTest>()
  for (const t of tests) {
    if (!latestBySoldier.has(t.soldier_id)) latestBySoldier.set(t.soldier_id, t)
  }

  const active = soldiers.filter((s) => s.status === 'active')
  const neverTested = active.filter((s) => !latestBySoldier.has(s.id))

  const flagged = active
    .filter((s) => latestBySoldier.has(s.id))
    .map((s) => {
      const latest = latestBySoldier.get(s.id)!
      const { flag, days } = aftFlag(latest.test_date)
      return { soldier: s, latest, flag, days }
    })
    .filter((r) => r.flag !== null)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  const overdue = flagged.filter((r) => r.flag === 'expired')
  const upcoming = flagged.filter((r) => r.flag === 'soon')

  const rowClass =
    'flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel p-3.5 text-left transition-colors hover:bg-surface-raised'

  return (
    <div className="mx-auto max-w-[760px]">
      <BackButton to="/admin/dashboard" label="Back to dashboard" />
      <h1 className="mb-2.5 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">AFT Tracker</h1>
      <p className="mb-5 text-[13px] text-ink-muted">Tap a Soldier to add their score. Soldiers can view their own history but can't change it.</p>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">NEVER TESTED</h2>
      {neverTested.length === 0 ? (
        <p className="mb-7 text-sm text-ink-muted">Every active Soldier has at least one AFT on record.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {neverTested.map((soldier) => (
            <button key={soldier.id} onClick={() => setModalSoldier(soldier)} className={rowClass}>
              <div className="text-sm font-semibold">
                {soldier.rank} {soldier.last_name}, {soldier.first_name}
              </div>
              <span className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink">
                NO RECORD
              </span>
            </button>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">OVERDUE</h2>
      {overdue.length === 0 ? (
        <p className="mb-7 text-sm text-ink-muted">No overdue AFTs.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {overdue.map(({ soldier, latest, days }) => (
            <button key={soldier.id} onClick={() => setModalSoldier(soldier)} className={rowClass}>
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {soldier.rank} {soldier.last_name}, {soldier.first_name}
                </div>
                <div className="text-xs text-ink-muted">
                  Last AFT: {formatDate(latest.test_date)}
                  {latest.overall_result ? ` — ${AFT_RESULT_LABEL[latest.overall_result]}` : ''}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-md bg-bad-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-bad-ink">
                {Math.abs(days!)}D OVERDUE
              </span>
            </button>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">UPCOMING</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-muted">No AFTs due soon.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {upcoming.map(({ soldier, latest, days }) => (
            <button key={soldier.id} onClick={() => setModalSoldier(soldier)} className={rowClass}>
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {soldier.rank} {soldier.last_name}, {soldier.first_name}
                </div>
                <div className="text-xs text-ink-muted">
                  Last AFT: {formatDate(latest.test_date)}
                  {latest.overall_result ? ` — ${AFT_RESULT_LABEL[latest.overall_result]}` : ''}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-md bg-warn-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-warn-ink">
                DUE IN {days}D
              </span>
            </button>
          ))}
        </div>
      )}

      {modalSoldier && (
        <AftScoreModal
          soldier={modalSoldier}
          onClose={() => setModalSoldier(null)}
          onSaved={() => {
            setModalSoldier(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
