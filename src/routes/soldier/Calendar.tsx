import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDrillEvents, isEventOpenForCheckIn, formatEventDateRange } from '../../lib/drillEvents'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listAttendanceForSoldier, attendanceBadge } from '../../lib/attendance'
import { useAuth } from '../../hooks/useAuth'
import type { Attendance, DrillEvent } from '../../types/database'

function monthDayLabel(dateStr: string) {
  const monthLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const dayLabel = dateStr.split('-')[2]
  return { monthLabel, dayLabel }
}

export function SoldierCalendar() {
  const { session } = useAuth()
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [records, setRecords] = useState<Record<string, Attendance>>({})

  useEffect(() => {
    if (!session) return
    listDrillEvents().then(setEvents)
    getOwnSoldierRecord(session.user.id).then((soldier) => {
      listAttendanceForSoldier(soldier.id).then((list) => {
        const map: Record<string, Attendance> = {}
        for (const r of list) map[r.drill_event_id] = r
        setRecords(map)
      })
    })
  }, [session])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => e.end_date >= today)

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:mb-5 sm:text-[26px]">
        Calendar
      </h1>
      <div className="flex flex-col gap-2">
        {upcoming.map((event) => {
          const { monthLabel, dayLabel } = monthDayLabel(event.event_date)
          const record = records[event.id]
          return (
            <Link
              key={event.id}
              to={`/soldier/calendar/${event.id}`}
              className="flex items-center gap-3.5 rounded-xl border border-line bg-panel p-3.5 transition-colors hover:bg-surface-raised"
            >
              <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-lg bg-info-bg">
                <div className="text-[10px] tracking-wide text-info-ink">{monthLabel}</div>
                <div className="font-display text-lg font-semibold">{dayLabel}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{event.title}</p>
                <p className="text-xs text-ink-muted">
                  {formatEventDateRange(event)}
                  {event.start_time ? ` · ${event.start_time}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              </div>
              {record ? (
                <span
                  className={`flex-shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-wide ${attendanceBadge(record).className}`}
                >
                  {attendanceBadge(record).label}
                </span>
              ) : isEventOpenForCheckIn(event) ? (
                <span className="flex-shrink-0 rounded-md bg-accent px-3 py-1.5 text-[11px] font-bold tracking-wide text-accent-ink">
                  CHECK IN
                </span>
              ) : (
                <span className="flex-shrink-0 text-xs font-semibold text-accent-soft-ink">Details &rarr;</span>
              )}
            </Link>
          )
        })}
        {upcoming.length === 0 && <p className="text-sm text-ink-muted">No upcoming drills scheduled.</p>}
      </div>
    </div>
  )
}
