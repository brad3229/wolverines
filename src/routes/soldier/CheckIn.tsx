import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDrillEvent, EVENT_TYPE_LABEL, formatEventDateRange, isEventOpenForCheckIn } from '../../lib/drillEvents'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listAttendanceForEvent, markAttendance } from '../../lib/attendance'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import type { Attendance, DrillEvent } from '../../types/database'

export function CheckIn() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [event, setEvent] = useState<DrillEvent | null>(null)
  const [record, setRecord] = useState<Attendance | null | undefined>(undefined)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!eventId || !session) return
    getDrillEvent(eventId).then(setEvent)
    getOwnSoldierRecord(session.user.id).then((soldier) => {
      listAttendanceForEvent(eventId).then((records) => {
        setRecord(records.find((r) => r.soldier_id === soldier.id) ?? null)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, session])

  async function handleCheckIn(checkInStatus: 'present' | 'late') {
    if (!eventId || !session) return
    setSubmitting(true)
    setError(null)
    try {
      const soldier = await getOwnSoldierRecord(session.user.id)
      const updated = await markAttendance({
        drillEventId: eventId,
        soldierId: soldier.id,
        status: checkInStatus,
        reason: checkInStatus === 'late' ? reason : null,
        markedBy: session.user.id,
      })
      setRecord(updated)
    } catch (err) {
      setError(errorMessage(err, 'Check-in failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!event || record === undefined) return <p className="text-sm text-ink-muted">Loading...</p>

  const today = new Date().toISOString().slice(0, 10)
  const isOpen = isEventOpenForCheckIn(event)
  const isFuture = event.event_date > today
  const badge =
    record?.status === 'late'
      ? { bg: 'bg-warn-bg', ink: 'text-warn-ink', label: 'RUNNING LATE' }
      : { bg: 'bg-good-bg', ink: 'text-good-ink', label: 'PRESENT' }

  return (
    <div className="max-w-[440px]">
      <button onClick={() => navigate('/soldier/calendar')} className="mb-4 text-sm text-ink-muted hover:text-ink-dim">
        &larr; Back to calendar
      </button>
      <p className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-display text-2xl font-semibold">{event.title}</span>
        <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-ink">
          {EVENT_TYPE_LABEL[event.event_type]}
        </span>
      </p>

      <div className="mb-5 rounded-xl border border-line bg-panel p-4 sm:p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs tracking-wide text-ink-muted">DATE</dt>
            <dd className="font-medium">{formatEventDateRange(event)}</dd>
          </div>
          {(event.start_time || event.end_time) && (
            <div>
              <dt className="text-xs tracking-wide text-ink-muted">TIME</dt>
              <dd className="font-medium">
                {event.start_time ?? '—'}
                {event.end_time ? ` – ${event.end_time}` : ''}
              </dd>
            </div>
          )}
          {event.location && (
            <div>
              <dt className="text-xs tracking-wide text-ink-muted">LOCATION</dt>
              <dd className="font-medium">{event.location}</dd>
            </div>
          )}
          {event.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs tracking-wide text-ink-muted">NOTES</dt>
              <dd className="whitespace-pre-wrap font-medium">{event.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {!record && isOpen ? (
        <>
          <p className="mb-2 text-xs text-ink-muted">
            This reports your status to cadre — it becomes official once confirmed at drill.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              disabled={submitting}
              onClick={() => handleCheckIn('present')}
              className="rounded-xl border border-good-border bg-good-bg py-4 text-center text-sm font-semibold tracking-wide text-good-ink transition-opacity disabled:opacity-50"
            >
              I'M PRESENT
            </button>
            <div className="rounded-xl border border-line bg-panel p-4">
              <label className="mb-2 block text-xs font-semibold tracking-wide text-ink-dim">RUNNING LATE?</label>
              <input
                placeholder="Reason (e.g. traffic)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <button
                disabled={submitting}
                onClick={() => handleCheckIn('late')}
                className="w-full rounded-md bg-warn-bg py-2.5 text-xs font-bold tracking-wide text-warn-ink disabled:opacity-50"
              >
                REPORT LATE
              </button>
            </div>
            {error && <p className="text-sm text-bad-ink">{error}</p>}
          </div>
        </>
      ) : !record ? (
        <div className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-ink-muted">
          {isFuture
            ? `Check-in opens ${event.event_date}.`
            : "This drill has passed. Contact your cadre if your attendance wasn't recorded."}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-panel px-5 py-7 text-center">
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
    </div>
  )
}
