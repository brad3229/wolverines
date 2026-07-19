import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listDrillEvents, formatEventDateRange, isEventOpenForCheckIn } from '../../lib/drillEvents'
import { listOwnEditRequests } from '../../lib/editRequests'
import { listOwnSutaRequests } from '../../lib/sutaRequests'
import { getAttendanceHistory, attendanceBadge, listAttendanceForEvent } from '../../lib/attendance'
import type { AttendanceHistoryEntry } from '../../lib/attendance'
import { flagForDate, daysUntil, ETS_WARNING_DAYS, CAC_WARNING_DAYS } from '../../lib/expirations'
import { useAuth } from '../../hooks/useAuth'
import type { Attendance, DrillEvent, Soldier } from '../../types/database'

function monthDayLabel(dateStr: string) {
  const monthLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const dayLabel = dateStr.split('-')[2]
  return { monthLabel, dayLabel }
}

export function Dashboard() {
  const { session } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [history, setHistory] = useState<AttendanceHistoryEntry[] | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [nextEventRecord, setNextEventRecord] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    getOwnSoldierRecord(session.user.id).then((s) => {
      setSoldier(s)
      Promise.all([
        listDrillEvents(),
        listOwnEditRequests(s.id),
        listOwnSutaRequests(s.id),
        getAttendanceHistory(s.id),
      ]).then(([eventData, editRequests, sutaRequests, attendance]) => {
        setEvents(eventData)
        setPendingTotal(
          editRequests.filter((r) => r.status === 'pending').length +
            sutaRequests.filter((r) => r.status === 'pending').length,
        )
        setHistory(attendance.history)
        setRate(attendance.rate)

        const today = new Date().toISOString().slice(0, 10)
        const next = eventData.filter((e) => e.end_date >= today)[0]
        if (next) {
          listAttendanceForEvent(next.id).then((records) => {
            setNextEventRecord(records.find((r) => r.soldier_id === s.id) ?? null)
            setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })
    })
  }, [session])

  if (loading || !soldier) return <p className="text-sm text-ink-muted">Loading dashboard...</p>

  const today = new Date().toISOString().slice(0, 10)
  const nextEvent = events.filter((e) => e.end_date >= today)[0]
  const isCurrent = !!nextEvent && isEventOpenForCheckIn(nextEvent)
  const nextEventLabel = isCurrent ? 'CURRENT EVENT' : 'NEXT DRILL'
  const etsFlag = flagForDate(soldier.ets_date, ETS_WARNING_DAYS)
  const cacFlag = flagForDate(soldier.cac_expiration_date, CAC_WARNING_DAYS)
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Dashboard</h1>
      <p className="mb-5 mt-1 text-[13px] text-ink-muted">{todayLabel} &middot; A CO 1-120 IN</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label={nextEventLabel}
          value={nextEvent ? `${monthDayLabel(nextEvent.event_date).monthLabel} ${monthDayLabel(nextEvent.event_date).dayLabel}` : '—'}
        />
        <StatTile
          label="ATTENDANCE RATE"
          value={rate === null ? '—' : `${rate}%`}
          valueClass={rate === null ? undefined : rate >= 80 ? 'text-good-ink' : rate >= 60 ? 'text-warn-ink' : 'text-bad-ink'}
        />
        <StatTile
          label="PENDING REQUESTS"
          value={String(pendingTotal)}
          valueClass={pendingTotal > 0 ? 'text-warn-ink' : undefined}
        />
      </div>

      {(etsFlag || cacFlag) && (
        <div className="mb-6 flex flex-col gap-1.5 rounded-xl border border-warn-border bg-warn-bg/10 p-4">
          <div className="text-sm font-semibold text-warn-ink">Action needed</div>
          {etsFlag && (
            <p className="text-sm text-ink-dim">
              Your ETS date is {soldier.ets_date} (
              {etsFlag === 'expired' ? 'past due' : `in ${daysUntil(soldier.ets_date)} days`}).
            </p>
          )}
          {cacFlag && soldier.cac_expiration_date && (
            <p className="text-sm text-ink-dim">
              Your CAC {cacFlag === 'expired' ? 'expired' : 'expires'} {soldier.cac_expiration_date} (
              {cacFlag === 'expired'
                ? `${Math.abs(daysUntil(soldier.cac_expiration_date))} days ago`
                : `in ${daysUntil(soldier.cac_expiration_date)} days`}
              ).
            </p>
          )}
        </div>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">{nextEventLabel}</h2>
      {nextEvent ? (
        <Link
          to={`/soldier/calendar/${nextEvent.id}`}
          className="mb-6 flex items-center gap-3.5 rounded-xl border border-line bg-panel p-3.5 transition-colors hover:bg-surface-raised"
        >
          <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-lg bg-info-bg">
            <div className="text-[10px] tracking-wide text-info-ink">{monthDayLabel(nextEvent.event_date).monthLabel}</div>
            <div className="font-display text-lg font-semibold">{monthDayLabel(nextEvent.event_date).dayLabel}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{nextEvent.title}</div>
            <div className="text-xs text-ink-muted">{formatEventDateRange(nextEvent)}</div>
          </div>
          {nextEventRecord ? (
            <span
              className={`flex-shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-wide ${attendanceBadge(nextEventRecord).className}`}
            >
              {attendanceBadge(nextEventRecord).label}
            </span>
          ) : (
            isEventOpenForCheckIn(nextEvent) && (
              <span className="flex-shrink-0 rounded-md bg-accent px-3 py-1.5 text-[11px] font-bold tracking-wide text-accent-ink">
                CHECK IN
              </span>
            )
          )}
        </Link>
      ) : (
        <p className="mb-6 text-sm text-ink-muted">No upcoming drills scheduled.</p>
      )}

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">ATTENDANCE HISTORY</h2>
      {!history ? (
        <p className="text-sm text-ink-muted">Loading...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-ink-muted">No past drills yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.slice(0, 10).map(({ event, record }) => {
            const badge = attendanceBadge(record)
            return (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-panel px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{event.title}</div>
                  <div className="text-xs text-ink-muted">{formatEventDateRange(event)}</div>
                </div>
                <span
                  className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
            )
          })}
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
