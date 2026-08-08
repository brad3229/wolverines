import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listAftTestsForSoldier, AFT_STANDARD_LABEL, AFT_RESULT_LABEL, AFT_RUN_EVENT_LABEL } from '../../lib/aft'
import { formatDate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { AftTest, Soldier } from '../../types/database'

export function Aft() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [tests, setTests] = useState<AftTest[]>([])
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setNotLinked(false)
    setError(null)
    getOwnSoldierRecord(session.user.id)
      .then((s) => {
        setSoldier(s)
        listAftTestsForSoldier(s.id)
          .then(setTests)
          .catch((err) => setError(errorMessage(err, 'Failed to load AFT scores')))
          .finally(() => setLoading(false))
      })
      .catch(() => {
        setNotLinked(true)
        setLoading(false)
      })
  }, [session])

  async function handlePreview(test: AftTest) {
    if (!soldier) return
    try {
      const { fillAftScorecard, previewPdf } = await import('../../lib/pdfForms')
      const bytes = await fillAftScorecard(soldier, test)
      previewPdf(bytes)
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate form'))
    }
  }

  if (loading) return <LoadingScreen />

  if (notLinked || !soldier) {
    return (
      <div className="mx-auto max-w-[640px]">
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so there&rsquo;s no AFT history to show.{' '}
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
        Your Army Fitness Test scores, recorded by cadre. You can view your history here but can&rsquo;t edit it.
      </p>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      {tests.length === 0 ? (
        <p className="text-sm text-ink-muted">No AFT scores on record yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tests.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {formatDate(t.test_date)} — {AFT_STANDARD_LABEL[t.standard]}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {t.total_points != null ? `${t.total_points} total points` : 'No total recorded'}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {t.overall_result && (
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        t.overall_result === 'go' ? 'bg-good-bg text-good-ink' : 'bg-bad-bg text-bad-ink'
                      }`}
                    >
                      {AFT_RESULT_LABEL[t.overall_result]}
                    </span>
                  )}
                  <button
                    onClick={() => handlePreview(t)}
                    className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                  >
                    PREVIEW FORM
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-soft pt-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-ink-faint">Deadlift: </span>
                  <span className="text-ink-dim">
                    {t.deadlift_lbs != null ? `${t.deadlift_lbs} lbs` : '—'}
                    {t.deadlift_points != null ? ` (${t.deadlift_points} pts)` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-ink-faint">Push-up: </span>
                  <span className="text-ink-dim">
                    {t.pushup_reps != null ? `${t.pushup_reps} reps` : '—'}
                    {t.pushup_points != null ? ` (${t.pushup_points} pts)` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-ink-faint">Sprint-Drag-Carry: </span>
                  <span className="text-ink-dim">
                    {t.sdc_time || '—'}
                    {t.sdc_points != null ? ` (${t.sdc_points} pts)` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-ink-faint">Plank: </span>
                  <span className="text-ink-dim">
                    {t.plank_time || '—'}
                    {t.plank_points != null ? ` (${t.plank_points} pts)` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-ink-faint">{AFT_RUN_EVENT_LABEL[t.run_event_type]}: </span>
                  <span className="text-ink-dim">
                    {t.run_event_time || '—'}
                    {t.run_event_points != null ? ` (${t.run_event_points} pts)` : ''}
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
