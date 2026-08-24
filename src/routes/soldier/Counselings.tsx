import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listCounselingsForSoldier } from '../../lib/counselings'
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
        Your developmental counselings, recorded by cadre. You can view your history here but can&rsquo;t edit it.
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
