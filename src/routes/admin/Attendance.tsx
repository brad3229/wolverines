import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { getDrillEvent, updateDrillEvent, EVENT_TYPE_LABEL, formatEventDateRange } from '../../lib/drillEvents'
import { listAttendanceForEvent, markAttendance, deleteAttendance, attendanceRowClass } from '../../lib/attendance'
import { EventForm, eventFormValuesToPayload } from '../../components/EventForm'
import { AttendanceSummary } from '../../components/AttendanceSummary'
import { BackButton } from '../../components/BackButton'
import { LoadingScreen } from '../../components/LoadingScreen'
import { SoldierAvatar } from '../../components/SoldierAvatar'
import { SQUADS } from '../../components/SoldierForm'
import { IconNote } from '../../components/icons'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/errors'
import { notify } from '../../lib/notifications'
import type { Attendance, AttendanceStatus, DrillEvent, Soldier } from '../../types/database'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-good-bg text-good-ink border-good-border' },
  { value: 'late', label: 'Late', activeClass: 'bg-warn-bg text-warn-ink border-warn-border' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-info-bg text-info-ink border-transparent' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-bad-bg text-bad-ink border-transparent' },
]

export function AttendancePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { session } = useAuth()
  const [event, setEvent] = useState<DrillEvent | null>(null)
  const [editing, setEditing] = useState(false)
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [records, setRecords] = useState<Record<string, Attendance>>({})
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ name: string; reason: string } | null>(null)

  useEffect(() => {
    if (!eventId) return
    setError(null)
    getDrillEvent(eventId)
      .then(setEvent)
      .catch((err) => setError(errorMessage(err, 'Failed to load event')))
    listSoldiers()
      .then((all) => setSoldiers(all.filter((s) => s.status === 'active')))
      .catch((err) => setError(errorMessage(err, 'Failed to load roster')))
    listAttendanceForEvent(eventId)
      .then((list) => {
        const map: Record<string, Attendance> = {}
        for (const r of list) map[r.soldier_id] = r
        setRecords(map)
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load attendance')))
  }, [eventId])

  async function writeStatus(soldierId: string, status: AttendanceStatus) {
    if (!eventId || !session) throw new Error('Missing event or session')
    const reason = status === 'late' || status === 'excused' ? reasonDrafts[soldierId] ?? '' : null
    return markAttendance({
      drillEventId: eventId,
      soldierId,
      status,
      reason,
      markedBy: session.user.id,
      confirmed: true,
    })
  }

  async function setStatus(soldierId: string, status: AttendanceStatus) {
    if (pending.has(soldierId)) return
    setPending((prev) => new Set(prev).add(soldierId))
    setError(null)
    try {
      const updated = await writeStatus(soldierId, status)
      setRecords((prev) => ({ ...prev, [soldierId]: updated }))
      setReasonDrafts((prev) => {
        const next = { ...prev }
        delete next[soldierId]
        return next
      })
    } catch (err) {
      setError(errorMessage(err, 'Failed to save reason'))
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(soldierId)
        return next
      })
    }
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
        // Only notify when cadre is confirming a Soldier's own unconfirmed self-report --
        // not for every routine roll-call mark, which would be noisy.
        const wasUnconfirmedSelfReport = !!previous && !previous.confirmed_by
        if (wasUnconfirmedSelfReport) {
          const targetSoldier = soldiers.find((s) => s.id === soldierId)
          notify({
            profileId: targetSoldier?.profile_id,
            title: 'Check-in confirmed',
            body: `${event?.title ?? 'Drill'} — marked ${status}`,
            link: '/soldier/calendar',
          })
        }
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

  if (!event) return error ? <p className="text-sm text-bad-ink">{error}</p> : <LoadingScreen />

  // Unassigned soldiers get their own trailing group instead of being hidden.
  const squadGroups = [...SQUADS, null]
    .map((squad) => ({ squad, soldiers: soldiers.filter((s) => s.squad === squad) }))
    .filter((g) => g.soldiers.length > 0)

  return (
    <div className="mx-auto max-w-[760px]">
      <BackButton to="/admin/calendar" label="Back to calendar" />
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
            {event.start_time && (
              <div>
                <dt className="text-xs tracking-wide text-ink-muted">FIRST FORMATION</dt>
                <dd className="font-medium">{event.start_time}</dd>
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
      {error && <p className="mb-2 text-sm text-bad-ink">{error}</p>}
      <AttendanceSummary soldiers={soldiers} records={records} />
      <div className="flex flex-col gap-4">
        {squadGroups.map((group) => (
          <div key={group.squad ?? 'unassigned'}>
            <h3 className="mb-2 font-display text-[13px] font-semibold tracking-wide text-ink-muted">
              {group.squad ?? 'UNASSIGNED'} ({group.soldiers.length})
            </h3>
            <div className="flex flex-col gap-2">
              {group.soldiers.map((soldier) => {
                const record = records[soldier.id]
                const needsReason = record?.status === 'late' || record?.status === 'excused'
                const isSelfReported =
                  !!record && !record.confirmed_by && (record.status === 'present' || record.status === 'late')
                return (
                  <div key={soldier.id} className={`rounded-xl border p-3.5 ${attendanceRowClass(record)}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <SoldierAvatar soldier={soldier} className="h-7 w-7" />
                        {soldier.rank} {soldier.last_name}, {soldier.first_name}
                        {isSelfReported && (
                          <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                            SELF-REPORTED
                          </span>
                        )}
                        {record?.reason && (
                          <button
                            onClick={() =>
                              setNoteModal({
                                name: `${soldier.rank} ${soldier.last_name}`,
                                reason: record.reason as string,
                              })
                            }
                            title="View comment"
                            className="text-info-ink"
                          >
                            <IconNote className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 sm:flex">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => toggleStatus(soldier.id, opt.value)}
                            disabled={pending.has(soldier.id)}
                            className={`rounded-md border px-2 py-2 text-[11px] font-bold tracking-wide transition-colors disabled:opacity-50 sm:px-3 ${
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
                          placeholder={record?.reason ? 'Add or replace comment' : 'Reason (e.g. traffic, appointment)'}
                          value={reasonDrafts[soldier.id] ?? ''}
                          onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [soldier.id]: e.target.value }))}
                          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                        />
                        <button
                          onClick={() => setStatus(soldier.id, record.status)}
                          disabled={pending.has(soldier.id)}
                          className="rounded-md bg-neutral-bg px-3 py-2 text-xs font-semibold text-neutral-ink disabled:opacity-50"
                        >
                          {pending.has(soldier.id) ? 'Saving...' : 'Save reason'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {soldiers.length === 0 && <p className="text-sm text-ink-muted">No active Soldiers on the roster.</p>}
      </div>

      {noteModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-2.5 rounded-xl border border-line bg-panel p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">{noteModal.name}</div>
            <p className="text-sm text-ink-dim">{noteModal.reason}</p>
            <button
              onClick={() => setNoteModal(null)}
              className="self-end rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
