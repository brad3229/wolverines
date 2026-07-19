import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { getDrillEvent, updateDrillEvent, EVENT_TYPE_LABEL, formatEventDateRange } from '../../lib/drillEvents'
import { listAttendanceForEvent, markAttendance, attendanceRowClass } from '../../lib/attendance'
import { EventForm, eventFormValuesToPayload } from '../../components/EventForm'
import { AttendanceSummary } from '../../components/AttendanceSummary'
import { useAuth } from '../../hooks/useAuth'
import type { Attendance, AttendanceStatus, DrillEvent, Soldier } from '../../types/database'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-good-bg text-good-ink border-good-border' },
  { value: 'late', label: 'Late', activeClass: 'bg-warn-bg text-warn-ink border-warn-border' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-info-bg text-info-ink border-transparent' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-bad-bg text-bad-ink border-transparent' },
]

export function AttendancePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [event, setEvent] = useState<DrillEvent | null>(null)
  const [editing, setEditing] = useState(false)
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [records, setRecords] = useState<Record<string, Attendance>>({})
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!eventId) return
    getDrillEvent(eventId).then(setEvent)
    listSoldiers().then((all) => setSoldiers(all.filter((s) => s.status === 'active')))
    listAttendanceForEvent(eventId).then((list) => {
      const map: Record<string, Attendance> = {}
      for (const r of list) map[r.soldier_id] = r
      setRecords(map)
    })
  }, [eventId])

  async function setStatus(soldierId: string, status: AttendanceStatus) {
    if (!eventId || !session) return
    const reason = status === 'late' || status === 'excused' ? reasonDrafts[soldierId] ?? '' : null
    const updated = await markAttendance({
      drillEventId: eventId,
      soldierId,
      status,
      reason,
      markedBy: session.user.id,
      confirmed: true,
    })
    setRecords((prev) => ({ ...prev, [soldierId]: updated }))
  }

  if (!event) return <p className="text-sm text-ink-muted">Loading...</p>

  return (
    <div className="max-w-[640px]">
      <button onClick={() => navigate('/admin/calendar')} className="mb-4 text-sm text-ink-muted hover:text-ink-dim">
        &larr; Back to calendar
      </button>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-display text-2xl font-semibold">{event.title}</span>
          <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-ink">
            {EVENT_TYPE_LABEL[event.event_type]}
          </span>
        </p>
        <button onClick={() => setEditing((v) => !v)} className="text-sm font-semibold text-accent-soft-ink">
          {editing ? 'Cancel' : 'Edit event'}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
        {editing ? (
          <EventForm
            initial={event}
            submitLabel="Save Changes"
            onSubmit={async (values) => {
              if (!eventId) return
              const updated = await updateDrillEvent(eventId, eventFormValuesToPayload(values))
              setEvent(updated)
              setEditing(false)
            }}
          />
        ) : (
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
        )}
      </div>

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">ATTENDANCE</h2>
      <AttendanceSummary soldiers={soldiers} records={records} />
      <div className="flex flex-col gap-2">
        {soldiers.map((soldier) => {
          const record = records[soldier.id]
          const needsReason = record?.status === 'late' || record?.status === 'excused'
          const isSelfReported =
            !!record && !record.confirmed_by && (record.status === 'present' || record.status === 'late')
          return (
            <div key={soldier.id} className={`rounded-xl border p-3.5 ${attendanceRowClass(record)}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {soldier.rank} {soldier.last_name}, {soldier.first_name}
                  {isSelfReported && (
                    <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                      SELF-REPORTED
                    </span>
                  )}
                </span>
                <div className="grid grid-cols-4 gap-1.5 sm:flex">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(soldier.id, opt.value)}
                      className={`rounded-md border px-2 py-2 text-[11px] font-bold tracking-wide transition-colors sm:px-3 ${
                        record?.status === opt.value ? opt.activeClass : 'border-line bg-neutral-bg text-ink-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {needsReason && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    placeholder="Reason (e.g. traffic, appointment)"
                    value={reasonDrafts[soldier.id] ?? record?.reason ?? ''}
                    onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [soldier.id]: e.target.value }))}
                    className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => setStatus(soldier.id, record.status)}
                    className="rounded-md bg-neutral-bg px-3 py-2 text-xs font-semibold text-neutral-ink"
                  >
                    Save reason
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {soldiers.length === 0 && <p className="text-sm text-ink-muted">No active Soldiers on the roster.</p>}
      </div>
    </div>
  )
}
