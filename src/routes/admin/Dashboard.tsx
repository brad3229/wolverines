import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { listDrillEvents, formatEventDateRange } from '../../lib/drillEvents'
import { listAttendanceForEvent } from '../../lib/attendance'
import { listEditRequests, reviewEditRequest, coerceEditRequestValue, formatEditRequestValue } from '../../lib/editRequests'
import { updateSoldier } from '../../lib/soldiers'
import { getExpiringSoldiers } from '../../lib/expirations'
import { useAuth } from '../../hooks/useAuth'
import type { DrillEvent, EditRequest, Soldier } from '../../types/database'

function monthDayLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-')
  const monthLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return { monthLabel, dayLabel: day ?? month }
}

export function Dashboard() {
  const { session, refreshPendingCounts } = useAuth()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [editRequests, setEditRequests] = useState<EditRequest[]>([])
  const [lastAttendancePct, setLastAttendancePct] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  function refresh() {
    setLoading(true)
    Promise.all([listSoldiers(), listDrillEvents(), listEditRequests()]).then(
      ([soldierData, eventData, requestData]) => {
        setSoldiers(soldierData)
        setEvents(eventData)
        setEditRequests(requestData.filter((r) => r.status === 'pending'))
        setLoading(false)

        const today = new Date().toISOString().slice(0, 10)
        const activeCount = soldierData.filter((s) => s.status === 'active').length
        const lastEvent =
          eventData.find((e) => e.event_date <= today && today <= e.end_date) ??
          [...eventData].reverse().find((e) => e.end_date < today)
        if (lastEvent) {
          listAttendanceForEvent(lastEvent.id).then((records) => {
            const present = records.filter(
              (r) => !!r.confirmed_by && (r.status === 'present' || r.status === 'late'),
            ).length
            setLastAttendancePct(activeCount ? Math.round((present / activeCount) * 100) : 0)
          })
        }
      },
    )
  }

  useEffect(refresh, [])

  async function handleReview(request: EditRequest, approve: boolean) {
    if (!session) return
    await reviewEditRequest({ id: request.id, approve, reviewedBy: session.user.id })
    if (approve) {
      await updateSoldier(request.soldier_id, {
        [request.field_name]: coerceEditRequestValue(request.field_name, request.new_value),
      })
    }
    refresh()
    refreshPendingCounts()
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading dashboard...</p>

  const today = new Date().toISOString().slice(0, 10)
  const activeCount = soldiers.filter((s) => s.status === 'active').length
  const upcomingEvents = events.filter((e) => e.end_date >= today).slice(0, 3)
  const nextEvent = upcomingEvents[0]
  const expiringSoldiers = getExpiringSoldiers(soldiers)
  const soldierName = (id: string) => {
    const s = soldiers.find((s) => s.id === id)
    return s ? `${s.rank} ${s.last_name}, ${s.first_name}` : 'Unknown Soldier'
  }
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="max-w-[900px]">
      <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Dashboard</h1>
      <p className="mb-5 mt-1 text-[13px] text-ink-muted">
        {todayLabel} &middot; A CO 1-120 IN
      </p>

      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ROSTER STRENGTH" value={String(activeCount)} />
        <StatTile label="NEXT DRILL" value={nextEvent ? monthDayLabel(nextEvent.event_date).monthLabel + ' ' + monthDayLabel(nextEvent.event_date).dayLabel : '—'} />
        <StatTile label="PENDING REQUESTS" value={String(editRequests.length)} valueClass="text-warn-ink" />
        <StatTile
          label="LAST DRILL ATTENDANCE"
          value={lastAttendancePct === null ? '—' : `${lastAttendancePct}%`}
          valueClass="text-good-ink"
        />
        <StatTile
          label="EXPIRING SOON"
          value={String(expiringSoldiers.length)}
          valueClass={expiringSoldiers.length > 0 ? 'text-warn-ink' : undefined}
        />
      </div>

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">UPCOMING EVENTS</h2>
      <div className="mb-7 flex flex-col gap-2">
        {upcomingEvents.map((event) => {
          const { monthLabel, dayLabel } = monthDayLabel(event.event_date)
          return (
            <div key={event.id} className="flex items-center gap-3.5 rounded-xl border border-line bg-panel p-3.5">
              <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-lg bg-info-bg">
                <div className="text-[10px] tracking-wide text-info-ink">{monthLabel}</div>
                <div className="font-display text-lg font-semibold">{dayLabel}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{event.title}</div>
                <div className="text-xs text-ink-muted">{formatEventDateRange(event)}</div>
              </div>
              <Link
                to={`/admin/calendar/${event.id}`}
                className="flex-shrink-0 rounded-md bg-accent px-3 py-1.5 text-[11px] font-bold tracking-wide text-accent-ink"
              >
                MANAGE
              </Link>
            </div>
          )
        })}
        {upcomingEvents.length === 0 && <p className="text-sm text-ink-muted">No upcoming events scheduled.</p>}
      </div>

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">UPCOMING EXPIRATIONS</h2>
      {expiringSoldiers.length === 0 ? (
        <p className="mb-7 py-1 text-sm text-ink-muted">Nothing expiring soon.</p>
      ) : (
        <div className="mb-7 flex flex-col gap-2">
          {expiringSoldiers.map(({ soldier, etsFlag, etsDays, cacFlag, cacDays }) => (
            <Link
              key={soldier.id}
              to={`/admin/roster/${soldier.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel p-3.5 transition-colors hover:bg-surface-raised"
            >
              <span className="text-sm font-semibold">
                {soldier.rank} {soldier.last_name}, {soldier.first_name}
              </span>
              <div className="flex flex-wrap gap-2">
                {etsFlag && (
                  <span
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                      etsFlag === 'expired' ? 'bg-bad-bg text-bad-ink' : 'bg-warn-bg text-warn-ink'
                    }`}
                  >
                    {etsFlag === 'expired' ? `ETS ${Math.abs(etsDays!)}D OVERDUE` : `ETS IN ${etsDays}D`}
                  </span>
                )}
                {cacFlag && (
                  <span
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                      cacFlag === 'expired' ? 'bg-bad-bg text-bad-ink' : 'bg-warn-bg text-warn-ink'
                    }`}
                  >
                    {cacFlag === 'expired' ? `CAC ${Math.abs(cacDays!)}D EXPIRED` : `CAC IN ${cacDays}D`}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">PENDING EDIT REQUESTS</h2>
      {editRequests.length === 0 ? (
        <p className="py-3 text-sm text-ink-muted">No pending requests.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {editRequests.map((req) => (
            <div key={req.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3.5">
              <div className="min-w-[180px] flex-1">
                <div className="text-sm font-semibold">{soldierName(req.soldier_id)}</div>
                <div className="text-xs text-ink-muted">
                  {req.field_name}:{' '}
                  <span className="text-ink-dim">{formatEditRequestValue(req.field_name, req.old_value)}</span>{' '}
                  &rarr; <span className="text-ink">{formatEditRequestValue(req.field_name, req.new_value)}</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button
                  onClick={() => handleReview(req, true)}
                  className="rounded-md bg-good-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-good-ink"
                >
                  APPROVE
                </button>
                <button
                  onClick={() => handleReview(req, false)}
                  className="rounded-md bg-bad-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-bad-ink"
                >
                  REJECT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-1.5 text-[11px] tracking-wide text-ink-muted">{label}</div>
      <div className={`font-display text-2xl font-semibold sm:text-[30px] ${valueClass ?? ''}`}>{value}</div>
    </div>
  )
}
