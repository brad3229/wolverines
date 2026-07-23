import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listOwnPayIssues, submitPayIssue } from '../../lib/payIssues'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { PayIssue, PayIssueCategory, PayIssueStatus, Soldier } from '../../types/database'

const CATEGORY_LABEL: Record<PayIssueCategory, string> = {
  missing_pay: 'Missing Pay',
  incorrect_amount: 'Incorrect Amount',
  les_error: 'LES Error',
  allotment_issue: 'Allotment Issue',
  va_disability_waiver: 'Waive Drill Pay (VA Disability)',
  other: 'Other',
}

const STATUS_BADGE: Record<PayIssueStatus, { label: string; className: string }> = {
  open: { label: 'OPEN', className: 'bg-warn-bg text-warn-ink' },
  in_progress: { label: 'IN PROGRESS', className: 'bg-info-bg text-info-ink' },
  resolved: { label: 'RESOLVED', className: 'bg-good-bg text-good-ink' },
}

export function PayIssues() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [issues, setIssues] = useState<PayIssue[]>([])
  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState<PayIssueCategory>('missing_pay')
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
      setIssues(await listOwnPayIssues(s.id))
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
        <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:mb-5 sm:text-[26px]">
          Pay Issues
        </h1>
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so you can&rsquo;t report a pay issue.{' '}
          {role === 'admin'
            ? 'Add yourself to the Roster and link your account to it, or have another admin do it.'
            : 'Ask an admin to add you to the Roster and link your account to it.'}
        </div>
      </div>
    )
  }

  async function handleSubmit() {
    if (!soldier || !description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await submitPayIssue({ soldierId: soldier.id, category, description: description.trim() })
      setShowForm(false)
      setCategory('missing_pay')
      setDescription('')
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit report'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Pay Issues</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showForm ? 'CANCEL' : '+ REPORT ISSUE'}
        </button>
      </div>
      <p className="mb-5 text-[13px] text-ink-muted">
        Missing pay, an incorrect amount, or an LES problem? Report it here and your chain of command will follow up.
      </p>

      {showForm && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">CATEGORY</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PayIssueCategory)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {(Object.keys(CATEGORY_LABEL) as PayIssueCategory[]).map((c) => (
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
              placeholder="Describe the pay issue"
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
              {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">MY REPORTS</h2>
      {issues.length === 0 ? (
        <p className="text-sm text-ink-muted">No pay issues reported yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {issues.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold">{CATEGORY_LABEL[i.category]}</div>
                  <div className="mt-0.5 text-xs italic text-ink-muted">&ldquo;{i.description}&rdquo;</div>
                  {i.status === 'resolved' && i.resolution_notes && (
                    <div className="mt-1 text-xs text-ink-dim">Resolution: {i.resolution_notes}</div>
                  )}
                </div>
                <span
                  className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${STATUS_BADGE[i.status].className}`}
                >
                  {STATUS_BADGE[i.status].label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
