import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDrillEvents, createDrillEvent, EVENT_TYPE_LABEL, formatEventDateRange } from '../../lib/drillEvents'
import { EventForm, eventFormValuesToPayload } from '../../components/EventForm'
import type { DrillEvent } from '../../types/database'

function monthDayLabel(dateStr: string) {
  const monthLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const dayLabel = dateStr.split('-')[2]
  return { monthLabel, dayLabel }
}

export function Calendar() {
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [showForm, setShowForm] = useState(false)

  function refresh() {
    listDrillEvents().then(setEvents)
  }

  useEffect(refresh, [])

  const { todayEvents, upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      todayEvents: events.filter((e) => e.event_date <= today && today <= e.end_date),
      upcomingEvents: events.filter((e) => e.event_date > today),
      pastEvents: [...events.filter((e) => e.end_date < today)].reverse(),
    }
  }, [events])

  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Calendar</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showForm ? 'CANCEL' : '+ NEW EVENT'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <EventForm
            submitLabel="Create Event"
            onSubmit={async (values) => {
              await createDrillEvent(eventFormValuesToPayload(values))
              setShowForm(false)
              refresh()
            }}
          />
        </div>
      )}

      {todayEvents.length > 0 && <EventGroup title="Today" events={todayEvents} highlightToday />}
      {upcomingEvents.length > 0 && <EventGroup title="Upcoming" events={upcomingEvents} />}
      {pastEvents.length > 0 && <EventGroup title="Past" events={pastEvents} muted />}
      {events.length === 0 && <p className="text-sm text-ink-muted">No drill events scheduled yet.</p>}
    </div>
  )
}

function EventGroup({
  title,
  events,
  muted,
  highlightToday,
}: {
  title: string
  events: DrillEvent[]
  muted?: boolean
  highlightToday?: boolean
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2.5 font-display text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => {
          const { monthLabel, dayLabel } = monthDayLabel(event.event_date)
          return (
            <Link
              key={event.id}
              to={`/admin/calendar/${event.id}`}
              className={`flex items-center gap-3.5 rounded-xl border border-line bg-panel p-3.5 transition-colors hover:bg-surface-raised ${
                muted ? 'opacity-70' : ''
              }`}
            >
              <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-lg bg-info-bg">
                <div className="text-[10px] tracking-wide text-info-ink">{monthLabel}</div>
                <div className="font-display text-lg font-semibold">{dayLabel}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {event.title}
                  <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-ink">
                    {EVENT_TYPE_LABEL[event.event_type]}
                  </span>
                  {highlightToday && (
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-soft-ink">
                      TODAY
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatEventDateRange(event)}
                  {event.start_time ? ` · ${event.start_time}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold text-accent-soft-ink">Manage &rarr;</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
