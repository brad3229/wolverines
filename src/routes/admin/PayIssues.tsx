import { useEffect, useState } from 'react'
import { listSoldiers } from '../../lib/soldiers'
import { listPayIssues, markPayIssueInProgress, resolvePayIssue } from '../../lib/payIssues'
import { useAuth } from '../../hooks/useAuth'
import type { PayIssue, PayIssueCategory, Soldier } from '../../types/database'

const CATEGORY_LABEL: Record<PayIssueCategory, string> = {
  missing_pay: 'Missing Pay',
  incorrect_amount: 'Incorrect Amount',
  les_error: 'LES Error',
  allotment_issue: 'Allotment Issue',
  va_disability_waiver: 'Waive Drill Pay (VA Disability)',
  other: 'Other',
}

export function PayIssues() {
  const { session, refreshPendingCounts } = useAuth()
  const [issues, setIssues] = useState<PayIssue[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  function refresh() {
    setLoading(true)
    Promise.all([listPayIssues(), listSoldiers()]).then(([i, s]) => {
      setIssues(i)
      setSoldiers(s)
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const soldierLabel = (id: string) => {
    const s = soldiers.find((s) => s.id === id)
    return s ? `${s.rank} ${s.last_name}, ${s.first_name}` : 'Unknown Soldier'
  }

  async function handleStart(issue: PayIssue) {
    await markPayIssueInProgress({ id: issue.id })
    refresh()
    refreshPendingCounts()
  }

  async function handleResolve(issue: PayIssue) {
    if (!session) return
    await resolvePayIssue({ id: issue.id, resolvedBy: session.user.id, notes: resolveDrafts[issue.id] ?? '' })
    refresh()
    refreshPendingCounts()
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading...</p>

  const open = issues.filter((i) => i.status === 'open')
  const inProgress = issues.filter((i) => i.status === 'in_progress')
  const resolved = issues.filter((i) => i.status === 'resolved')

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-5 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Pay Issues</h1>

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">OPEN</h2>
      {open.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">No open pay issues.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {open.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{soldierLabel(i.soldier_id)}</div>
                  <div className="text-xs text-ink-muted">{CATEGORY_LABEL[i.category]}</div>
                  <div className="mt-1 text-xs italic text-ink-dim">&ldquo;{i.description}&rdquo;</div>
                </div>
                <button
                  onClick={() => handleStart(i)}
                  className="flex-shrink-0 rounded-md bg-info-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-info-ink"
                >
                  START WORKING
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Resolution notes (optional to resolve directly)"
                  value={resolveDrafts[i.id] ?? ''}
                  onChange={(e) => setResolveDrafts((prev) => ({ ...prev, [i.id]: e.target.value }))}
                  className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleResolve(i)}
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
          {inProgress.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="mb-2.5">
                <div className="text-sm font-semibold">{soldierLabel(i.soldier_id)}</div>
                <div className="text-xs text-ink-muted">{CATEGORY_LABEL[i.category]}</div>
                <div className="mt-1 text-xs italic text-ink-dim">&ldquo;{i.description}&rdquo;</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Resolution notes"
                  value={resolveDrafts[i.id] ?? ''}
                  onChange={(e) => setResolveDrafts((prev) => ({ ...prev, [i.id]: e.target.value }))}
                  className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleResolve(i)}
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
        <p className="text-sm text-ink-muted">No resolved issues yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {resolved.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-panel p-3.5 opacity-70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{soldierLabel(i.soldier_id)}</div>
                  <div className="text-xs text-ink-muted">{CATEGORY_LABEL[i.category]}</div>
                  {i.resolution_notes && <div className="mt-1 text-xs text-ink-dim">Resolution: {i.resolution_notes}</div>}
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
