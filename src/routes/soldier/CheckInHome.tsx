import { useEffect, useState } from 'react'
import { listDrillEvents, formatEventDateRange, EVENT_TYPE_LABEL } from '../../lib/drillEvents'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listAttendanceForEvent, markAttendance } from '../../lib/attendance'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { Attendance, DrillEvent, Soldier } from '../../types/database'

export function CheckInHome() {
  const { session } = useAuth()
  const [todayEvent, setTodayEvent] = useState<DrillEvent | null | undefined>(undefined)
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [record, setRecord] = useState<Attendance | null>(null)
  const [reason, setReason] = useState('')
  const [showLateReason, setShowLateReason] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!session) return
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [events, ownSoldier] = await Promise.all([listDrillEvents(), getOwnSoldierRecord(session.user.id)])
      const drill = events.find((e) => e.event_date <= today && today <= e.end_date) ?? null
      setTodayEvent(drill)
      setSoldier(ownSoldier)
      if (drill) {
        const records = await listAttendanceForEvent(drill.id)
        setRecord(records.find((r) => r.soldier_id === ownSoldier.id) ?? null)
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to load check-in status'))
      setTodayEvent(null)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function checkIn(status: 'present' | 'late') {
    if (!todayEvent || !soldier || !session) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await markAttendance({
        drillEventId: todayEvent.id,
        soldierId: soldier.id,
        status,
        reason: status === 'late' ? reason : null,
        markedBy: session.user.id,
      })
      setRecord(updated)
      setShowLateReason(false)
    } catch (err) {
      setError(errorMessage(err, 'Check-in failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const badge =
    record?.status === 'late'
      ? { bg: 'bg-warn-bg', ink: 'text-warn-ink', label: 'RUNNING LATE' }
      : { bg: 'bg-good-bg', ink: 'text-good-ink', label: 'PRESENT' }

  return (
    <div className="mx-auto max-w-[480px]">
      <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:mb-5 sm:text-[26px]">
        Check-In
      </h1>

      {todayEvent === undefined ? (
        <LoadingScreen />
      ) : error && !todayEvent ? (
        <p className="text-sm text-bad-ink">{error}</p>
      ) : todayEvent === null ? (
        <div className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-ink-muted">
          No drill today. Check back closer to the weekend.
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-xl border border-line bg-panel p-5">
            <div className="mb-1.5 text-[11px] tracking-wide text-ink-muted">TODAY'S DRILL</div>
            <div className="mb-0.5 font-display text-xl font-semibold">{todayEvent.title}</div>
            <div className="text-sm text-ink-muted">
              {EVENT_TYPE_LABEL[todayEvent.event_type]} &middot; {formatEventDateRange(todayEvent)}
            </div>
          </div>

          {!record ? (
            <div className="flex flex-col gap-2.5">
              <button
                disabled={submitting}
                onClick={() => checkIn('present')}
                className="rounded-xl border border-good-border bg-good-bg py-4 text-center text-sm font-semibold tracking-wide text-good-ink transition-opacity disabled:opacity-50"
              >
                I'M PRESENT
              </button>
              {!showLateReason ? (
                <button
                  disabled={submitting}
                  onClick={() => setShowLateReason(true)}
                  className="rounded-xl border border-warn-border bg-warn-bg py-4 text-center text-sm font-semibold tracking-wide text-warn-ink transition-opacity disabled:opacity-50"
                >
                  RUNNING LATE
                </button>
              ) : (
                <div className="rounded-xl border border-line bg-panel p-4">
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-ink-dim">
                    REASON (E.G. TRAFFIC)
                  </label>
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={submitting}
                      onClick={() => checkIn('late')}
                      className="flex-1 rounded-md bg-warn-bg py-2.5 text-xs font-semibold tracking-wide text-warn-ink disabled:opacity-50"
                    >
                      REPORT LATE
                    </button>
                    <button
                      onClick={() => setShowLateReason(false)}
                      className="rounded-md bg-neutral-bg px-3 py-2.5 text-xs font-semibold tracking-wide text-neutral-ink"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-bad-ink">{error}</p>}
            </div>
          ) : (
            <div className={`rounded-xl border border-line bg-panel px-5 py-7 text-center`}>
              <div className={`mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full ${badge.bg}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-6 w-6 ${badge.ink}`}>
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="mb-1 font-display text-lg font-semibold">{badge.label}</div>
              <div className="mb-3 text-xs text-ink-muted">
                Checked in at {new Date(record.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {record.confirmed_by ? (
                <span className="inline-block rounded-md bg-good-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-good-ink">
                  CONFIRMED BY CADRE
                </span>
              ) : (
                <span className="inline-block rounded-md bg-warn-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-warn-ink">
                  AWAITING CADRE CONFIRMATION
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
