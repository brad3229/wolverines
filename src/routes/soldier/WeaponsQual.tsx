import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listWeaponsQualificationsForSoldier, WEAPONS_QUAL_RATING_LABEL } from '../../lib/weaponsQual'
import { formatDate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { Soldier, WeaponsQualification } from '../../types/database'

export function WeaponsQual() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [quals, setQuals] = useState<WeaponsQualification[]>([])
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
        listWeaponsQualificationsForSoldier(s.id)
          .then(setQuals)
          .catch((err) => setError(errorMessage(err, 'Failed to load weapons qualifications')))
          .finally(() => setLoading(false))
      })
      .catch(() => {
        setNotLinked(true)
        setLoading(false)
      })
  }, [session])

  async function handlePreview(qual: WeaponsQualification) {
    if (!soldier) return
    try {
      const { fillWeaponsQualScorecard, previewPdf } = await import('../../lib/pdfForms')
      const bytes = await fillWeaponsQualScorecard(soldier, qual)
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
          Your account isn&rsquo;t linked to a Soldier record on the roster, so there&rsquo;s no weapons
          qualification history to show.{' '}
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
        Your weapons qualifications, recorded by the Range OIC. You can view your history here but can&rsquo;t edit
        it.
      </p>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      {quals.length === 0 ? (
        <p className="text-sm text-ink-muted">No weapons qualifications on record yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {quals.map((q) => (
            <div key={q.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {formatDate(q.qual_date)} — {q.weapon_type}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {q.total_hits != null ? `${q.total_hits}/40 pts` : 'No score recorded'}
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                  {q.qualification_rating && (
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        q.qualification_rating === 'unqualified' ? 'bg-bad-bg text-bad-ink' : 'bg-good-bg text-good-ink'
                      }`}
                    >
                      {WEAPONS_QUAL_RATING_LABEL[q.qualification_rating].toUpperCase()}
                    </span>
                  )}
                  <button
                    onClick={() => handlePreview(q)}
                    className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                  >
                    PREVIEW FORM
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
