import { useEffect, useState } from 'react'
import { listSoldiers } from '../../lib/soldiers'
import { listDrillEvents, formatEventDateRange } from '../../lib/drillEvents'
import { listAttendanceForEvent, markAttendance, deleteAttendance, attendanceRowClass } from '../../lib/attendance'
import { AttendanceSummary } from '../../components/AttendanceSummary'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/errors'
import type { Attendance, AttendanceStatus, DrillEvent, Soldier } from '../../types/database'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'PRESENT', activeClass: 'bg-good-bg text-good-ink border-good-border' },
  { value: 'late', label: 'LATE', activeClass: 'bg-warn-bg text-warn-ink border-warn-border' },
  { value: 'absent', label: 'ABSENT', activeClass: 'bg-bad-bg text-bad-ink border-transparent' },
  { value: 'excused', label: 'EXCUSED', activeClass: 'bg-info-bg text-info-ink border-transparent' },
]

export function AttendanceHome() {
  const { session } = useAuth()
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [eventId, setEventId] = useState('')
  const [records, setRecords] = useState<Record<string, Attendance>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listDrillEvents(), listSoldiers()]).then(([eventData, soldierData]) => {
      setEvents(eventData)
      setSoldiers(soldierData.filter((s) => s.status === 'active'))
      const today = new Date().toISOString().slice(0, 10)
      const defaultEvent =
        eventData.find((e) => e.event_date <= today && today <= e.end_date) ??
        eventData.find((e) => e.event_date > today) ??
        eventData[0]
      setEventId(defaultEvent?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (!eventId) return
    listAttendanceForEvent(eventId).then((list) => {
      const map: Record<string, Attendance> = {}
      for (const r of list) map[r.soldier_id] = r
      setRecords(map)
    })
  }, [eventId])

  async function writeStatus(soldierId: string, status: AttendanceStatus) {
    if (!eventId || !session) throw new Error('Missing event or session')
    return markAttendance({
      drillEventId: eventId,
      soldierId,
      status,
      reason: records[soldierId]?.reason ?? null,
      markedBy: session.user.id,
      confirmed: true,
    })
  }

  // Clicking the already-active status again clears it, in case it was a mis-click.
  // Updates `records` immediately (optimistic) so the button reflects the change before
  // the round trip finishes, then reconciles with the real row or rolls back on failure.
  // Guarded by `pending` so a second click can't race the first one's in-flight request.
  async function toggleStatus(soldierId: string, status: AttendanceStatus) {
    if (!eventId || pending.has(soldierId)) return
    const previous = records[soldierId]
    const isActive = previous?.status === status
    setPending((prev) => new Set(prev).add(soldierId))
    setError(null)

    if (isActive) {
      setRecords((prev) => {
        const next = { ...prev }
        delete next[soldierId]
        return next
      })
    } else {
      setRecords((prev) => ({
        ...prev,
        [soldierId]: {
          id: previous?.id ?? `optimistic-${soldierId}`,
          drill_event_id: eventId,
          soldier_id: soldierId,
          status,
          reason: previous?.reason ?? null,
          marked_by: session?.user.id ?? '',
          marked_at: new Date().toISOString(),
          confirmed_by: session?.user.id ?? null,
          confirmed_at: new Date().toISOString(),
        },
      }))
    }

    try {
      if (isActive) {
        await deleteAttendance({ drillEventId: eventId, soldierId })
      } else {
        const updated = await writeStatus(soldierId, status)
        setRecords((prev) => ({ ...prev, [soldierId]: updated }))
      }
    } catch (err) {
      setRecords((prev) => {
        const next = { ...prev }
        if (previous) next[soldierId] = previous
        else delete next[soldierId]
        return next
      })
      setError(errorMessage(err, 'Failed to update attendance'))
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(soldierId)
        return next
      })
    }
  }

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:mb-5 sm:text-[26px]">
        Attendance
      </h1>

      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">No drill events scheduled yet.</p>
      ) : (
        <>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mb-5 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {formatEventDateRange(event)}
              </option>
            ))}
          </select>

          {error && <p className="mb-2 text-sm text-bad-ink">{error}</p>}
          <AttendanceSummary soldiers={soldiers} records={records} />

          <div className="flex flex-col gap-2">
            {soldiers.map((soldier) => {
              const record = records[soldier.id]
              const status = record?.status
              const isSelfReported = !!record && !record.confirmed_by && (status === 'present' || status === 'late')
              return (
                <div
                  key={soldier.id}
                  className={`flex flex-col gap-2.5 rounded-xl border p-3.5 ${attendanceRowClass(record)}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {soldier.rank} {soldier.last_name}, {soldier.first_name}
                    {isSelfReported && (
                      <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                        SELF-REPORTED
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => toggleStatus(soldier.id, opt.value)}
                        disabled={pending.has(soldier.id)}
                        className={`rounded-md border px-1 py-2.5 text-center text-[10px] font-bold tracking-wide transition-colors disabled:opacity-50 ${
                          status === opt.value ? opt.activeClass : 'border-line bg-neutral-bg text-ink-muted'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {soldiers.length === 0 && <p className="text-sm text-ink-muted">No active Soldiers on the roster.</p>}
          </div>
        </>
      )}
    </div>
  )
}
