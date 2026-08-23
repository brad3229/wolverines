import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { listDrillEvents, formatEventDateRange } from '../../lib/drillEvents'
import { listAttendanceForEvent } from '../../lib/attendance'
import { listEditRequests, reviewEditRequest, coerceEditRequestValue, formatEditRequestValue } from '../../lib/editRequests'
import { updateSoldier } from '../../lib/soldiers'
import {
  getExpiringSoldiers,
  CAC_WARNING_DAYS,
  ETS_WARNING_DAYS,
  NCOER_WARNING_DAYS,
  type ExpirationFlag,
  type SoldierExpiration,
} from '../../lib/expirations'
import { errorMessage } from '../../lib/errors'
import { notify } from '../../lib/notifications'
import { todayLocalDateString } from '../../lib/dates'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import { IconRoster, IconCalendar, IconInbox, IconAttendance, IconAlertTriangle, IconEvaluation } from '../../components/icons'
import type { DrillEvent, EditRequest, Soldier } from '../../types/database'

const PRIORITY_WARNING_DAYS: Record<'ETS' | 'CAC' | 'NCOER', number> = {
  ETS: ETS_WARNING_DAYS,
  CAC: CAC_WARNING_DAYS,
  NCOER: NCOER_WARNING_DAYS,
}

type Priority =
  | { kind: 'expiring'; soldier: Soldier; category: 'ETS' | 'CAC' | 'NCOER'; flag: ExpirationFlag; days: number }
  | { kind: 'edit_requests'; count: number }

// Reduces a soldier's (up to three) flagged categories to just the single
// most urgent one -- the same soldier shouldn't take two of the two priority
// slots just because both their CAC and ETS happen to be flagged.
function mostUrgentFlag(e: SoldierExpiration): Priority {
  const options = (
    [
      { category: 'ETS' as const, flag: e.etsFlag, days: e.etsDays },
      { category: 'CAC' as const, flag: e.cacFlag, days: e.cacDays },
      { category: 'NCOER' as const, flag: e.ncoerFlag, days: e.ncoerDays },
    ] satisfies { category: 'ETS' | 'CAC' | 'NCOER'; flag: ExpirationFlag; days: number | null }[]
  ).filter((o): o is { category: 'ETS' | 'CAC' | 'NCOER'; flag: ExpirationFlag; days: number } => o.flag !== null)
  const top = options.reduce((min, o) => (o.days < min.days ? o : min))
  return { kind: 'expiring', soldier: e.soldier, category: top.category, flag: top.flag, days: top.days }
}

// Edit requests have no natural "days" measure to compare against expiration
// countdowns, so they're pinned at rank 0 -- anything already overdue (a
// negative day count) still outranks the request queue, but the queue
// outranks anything merely "due soon" (a positive day count).
function priorityRank(p: Priority) {
  return p.kind === 'edit_requests' ? 0 : p.days
}

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
  const [lastDrillPresentCount, setLastDrillPresentCount] = useState<number | null>(null)
  const [lastDrillEventId, setLastDrillEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    setLoadError(null)
    Promise.all([listSoldiers(), listDrillEvents(), listEditRequests()])
      .then(([soldierData, eventData, requestData]) => {
        setSoldiers(soldierData)
        setEvents(eventData)
        setEditRequests(requestData.filter((r) => r.status === 'pending'))
        setLoading(false)

        const today = todayLocalDateString()
        const lastEvent =
          eventData.find((e) => e.event_date <= today && today <= e.end_date) ??
          [...eventData].reverse().find((e) => e.end_date < today)
        if (lastEvent) {
          setLastDrillEventId(lastEvent.id)
          listAttendanceForEvent(lastEvent.id)
            .then((records) => {
              const present = records.filter(
                (r) => !!r.confirmed_by && (r.status === 'present' || r.status === 'late'),
              ).length
              setLastDrillPresentCount(present)
            })
            .catch((err) => setLoadError(errorMessage(err, 'Failed to load last drill attendance')))
        }
      })
      .catch((err) => {
        setLoadError(errorMessage(err, 'Failed to load dashboard'))
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  async function handleReview(request: EditRequest, approve: boolean) {
    if (!session) return
    try {
      await reviewEditRequest({ id: request.id, approve, reviewedBy: session.user.id })
      if (approve) {
        await updateSoldier(request.soldier_id, {
          [request.field_name]: coerceEditRequestValue(request.field_name, request.new_value),
        })
      }
      const soldier = soldiers.find((s) => s.id === request.soldier_id)
      notify({
        profileId: soldier?.profile_id,
        title: approve ? 'Profile edit approved' : 'Profile edit rejected',
        body: `${request.field_name}: ${formatEditRequestValue(request.field_name, request.new_value)}`,
        link: '/soldier/profile',
      })
      refresh()
      refreshPendingCounts()
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to review request'))
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return <LoadingScreen />

  const today = todayLocalDateString()
  const activeCount = soldiers.filter((s) => s.status === 'active').length
  const upcomingEvents = events.filter((e) => e.end_date >= today).slice(0, 3)
  const nextEvent = upcomingEvents[0]
  const expiringSoldiers = getExpiringSoldiers(soldiers)
  const ncoerDueCount = expiringSoldiers.filter((s) => s.ncoerFlag !== null).length
  // expiringSoldiers is already sorted most-urgent-first, so nothing past index 1 could
  // ever outrank what's already in these top two candidates -- see priorityRank above.
  const topPriorities = [
    ...expiringSoldiers.slice(0, 2).map(mostUrgentFlag),
    ...(editRequests.length > 0 ? [{ kind: 'edit_requests' as const, count: editRequests.length }] : []),
  ]
    .sort((a, b) => priorityRank(a) - priorityRank(b))
    .slice(0, 2)
  const soldierName = (id: string) => {
    const s = soldiers.find((s) => s.id === id)
    return s ? `${s.rank} ${s.last_name}, ${s.first_name}` : 'Unknown Soldier'
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      {loadError && <p className="mb-4 text-sm text-bad-ink">{loadError}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Primary column */}
        <div>
          {topPriorities.length > 0 && (
            <div className="mb-7">
              <h2 className="mb-2.5 font-display text-[13px] font-semibold tracking-wide text-ink-dim">
                TOP PRIORITIES
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {topPriorities.map((p, i) => (
                  <PriorityCard key={i} priority={p} onReviewRequests={() => scrollToSection('pending-edit-requests')} />
                ))}
              </div>
            </div>
          )}

          <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              icon={<IconRoster />}
              accent="accent"
              label="ROSTER STRENGTH"
              value={String(activeCount)}
              to="/admin/roster"
            />
            <StatTile
              icon={<IconCalendar />}
              accent="info"
              label="NEXT DRILL"
              value={nextEvent ? monthDayLabel(nextEvent.event_date).monthLabel + ' ' + monthDayLabel(nextEvent.event_date).dayLabel : '—'}
              to={nextEvent ? `/admin/calendar/${nextEvent.id}` : '/admin/calendar'}
            />
            <StatTile
              icon={<IconInbox />}
              accent="warn"
              label="PENDING REQUESTS"
              value={String(editRequests.length)}
              valueClass="text-warn-ink"
              onClick={() => scrollToSection('pending-edit-requests')}
            />
            <StatTile
              icon={<IconAttendance />}
              accent="good"
              label="LAST DRILL ATTENDANCE"
              value={lastDrillPresentCount === null ? '—' : String(lastDrillPresentCount)}
              valueClass="text-good-ink"
              to={lastDrillEventId ? `/admin/calendar/${lastDrillEventId}` : undefined}
            />
            <StatTile
              icon={<IconAlertTriangle />}
              accent="warn"
              label="EXPIRING SOON"
              value={String(expiringSoldiers.length)}
              valueClass={expiringSoldiers.length > 0 ? 'text-warn-ink' : undefined}
              onClick={() => scrollToSection('upcoming-expirations')}
            />
            <StatTile
              icon={<IconEvaluation />}
              accent="warn"
              label="NCOER DUE"
              value={String(ncoerDueCount)}
              valueClass={ncoerDueCount > 0 ? 'text-warn-ink' : undefined}
              to="/admin/ncoer"
            />
          </div>

          <SectionCard title="UPCOMING EVENTS" count={upcomingEvents.length}>
            {upcomingEvents.map((event) => {
              const { monthLabel, dayLabel } = monthDayLabel(event.event_date)
              return (
                <Link
                  key={event.id}
                  to={`/admin/calendar/${event.id}`}
                  className="flex items-center gap-3.5 rounded-lg p-2.5 transition-colors hover:bg-surface-raised"
                >
                  <div className="flex h-[46px] w-[46px] flex-shrink-0 flex-col items-center justify-center rounded-lg bg-info-bg">
                    <div className="text-[9px] tracking-wide text-info-ink">{monthLabel}</div>
                    <div className="font-display text-base font-semibold">{dayLabel}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{event.title}</div>
                    <div className="text-xs text-ink-muted">{formatEventDateRange(event)}</div>
                  </div>
                </Link>
              )
            })}
            {upcomingEvents.length === 0 && <p className="p-2.5 text-sm text-ink-muted">No upcoming events scheduled.</p>}
          </SectionCard>
        </div>

        {/* Watchlist column */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-0">
          <SectionCard title="EXPIRING SOON" count={expiringSoldiers.length} id="upcoming-expirations">
            {expiringSoldiers.length === 0 ? (
              <p className="p-2.5 text-sm text-ink-muted">Nothing expiring soon.</p>
            ) : (
              expiringSoldiers.map(({ soldier, etsFlag, etsDays, cacFlag, cacDays, ncoerFlag, ncoerDays }) => (
                <Link
                  key={soldier.id}
                  to={`/admin/roster/${soldier.id}`}
                  className="flex flex-col gap-1.5 rounded-lg p-2.5 transition-colors hover:bg-surface-raised"
                >
                  <span className="text-sm font-semibold">
                    {soldier.rank} {soldier.last_name}, {soldier.first_name}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {etsFlag && (
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${
                          etsFlag === 'expired' ? 'bg-bad-bg text-bad-ink' : 'bg-warn-bg text-warn-ink'
                        }`}
                      >
                        {etsFlag === 'expired' ? `ETS ${Math.abs(etsDays!)}D OVERDUE` : `ETS IN ${etsDays}D`}
                      </span>
                    )}
                    {cacFlag && (
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${
                          cacFlag === 'expired' ? 'bg-bad-bg text-bad-ink' : 'bg-warn-bg text-warn-ink'
                        }`}
                      >
                        {cacFlag === 'expired' ? `CAC ${Math.abs(cacDays!)}D EXPIRED` : `CAC IN ${cacDays}D`}
                      </span>
                    )}
                    {ncoerFlag && (
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${
                          ncoerFlag === 'expired' ? 'bg-bad-bg text-bad-ink' : 'bg-warn-bg text-warn-ink'
                        }`}
                      >
                        {ncoerFlag === 'expired' ? `NCOER ${Math.abs(ncoerDays!)}D OVERDUE` : `NCOER DUE IN ${ncoerDays}D`}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </SectionCard>

          <SectionCard title="PENDING EDIT REQUESTS" count={editRequests.length} id="pending-edit-requests">
            {editRequests.length === 0 ? (
              <p className="p-2.5 text-sm text-ink-muted">No pending requests.</p>
            ) : (
              editRequests.map((req) => (
                <div key={req.id} className="flex flex-col gap-2.5 rounded-lg p-2.5">
                  <div>
                    <div className="text-sm font-semibold">{soldierName(req.soldier_id)}</div>
                    <div className="text-xs text-ink-muted">
                      {req.field_name}:{' '}
                      <span className="text-ink-dim">{formatEditRequestValue(req.field_name, req.old_value)}</span>{' '}
                      &rarr; <span className="text-ink">{formatEditRequestValue(req.field_name, req.new_value)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
              ))
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

// Tone-matched bar/badge colors, same expired=bad / soon=warn convention the
// EXPIRING SOON list below already uses for its pills.
const PRIORITY_TONE = {
  bad: { badge: 'bg-bad-bg text-bad-ink', bar: 'bg-bad-ink', pill: 'bg-bad-bg text-bad-ink' },
  warn: { badge: 'bg-warn-bg text-warn-ink', bar: 'bg-warn-ink', pill: 'bg-warn-bg text-warn-ink' },
} as const

function PriorityCard({ priority, onReviewRequests }: { priority: Priority; onReviewRequests: () => void }) {
  const cardClass =
    'flex items-center gap-3.5 rounded-xl border border-line bg-panel p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-line-soft hover:shadow-lg'

  if (priority.kind === 'edit_requests') {
    const tone = PRIORITY_TONE.warn
    return (
      <button onClick={onReviewRequests} className={cardClass}>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
          <IconInbox />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {priority.count} pending edit request{priority.count === 1 ? '' : 's'}
          </div>
          <div className="text-xs text-ink-muted">Waiting for your review</div>
        </div>
      </button>
    )
  }

  const { soldier, category, flag, days } = priority
  const tone = PRIORITY_TONE[flag === 'expired' ? 'bad' : 'warn']
  const windowDays = PRIORITY_WARNING_DAYS[category]
  // How much of the warning window has already elapsed, as a shrinking-runway bar --
  // capped at 100% once expired rather than continuing to grow past it.
  const elapsedPct = Math.max(0, Math.min(100, Math.round(((windowDays - days) / windowDays) * 100)))
  const detail =
    flag === 'expired'
      ? `${category} expired ${Math.abs(days)}d ago`
      : `${category} due in ${days}d`

  return (
    <Link to={`/admin/roster/${soldier.id}`} className={cardClass}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
        <IconAlertTriangle />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {soldier.rank} {soldier.last_name}, {soldier.first_name}
        </div>
        <div className="mb-2 mt-1">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tone.pill}`}>{detail}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${elapsedPct}%` }} />
        </div>
      </div>
    </Link>
  )
}

function SectionCard({
  title,
  count,
  id,
  children,
}: {
  title: string
  count: number
  id?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 id={id} className="font-display text-[13px] font-semibold tracking-wide text-ink-dim">
          {title}
        </h2>
        <span className="text-xs text-ink-faint">{count}</span>
      </div>
      <div className="flex flex-col gap-1 p-2.5">{children}</div>
    </div>
  )
}

const STAT_ACCENT = {
  accent: { badge: 'bg-accent-soft text-accent-soft-ink', card: 'bg-accent' },
  info: { badge: 'bg-info-bg text-info-ink', card: 'bg-info-ink' },
  warn: { badge: 'bg-warn-bg text-warn-ink', card: 'bg-warn-ink' },
  good: { badge: 'bg-good-bg text-good-ink', card: 'bg-good-ink' },
} as const

function StatTile({
  icon,
  accent,
  label,
  value,
  valueClass,
  to,
  onClick,
}: {
  icon: ReactNode
  accent: keyof typeof STAT_ACCENT
  label: string
  value: string
  valueClass?: string
  to?: string
  onClick?: () => void
}) {
  const { badge, card } = STAT_ACCENT[accent]
  // The rim is a fixed-height absolutely positioned strip, not a nested flow element --
  // that keeps it immune to the grid row stretching shorter tiles to match a taller
  // neighbor (which previously left a gap that exposed the accent color at the bottom too).
  const content = (
    <>
      <div className={`absolute inset-x-0 top-0 h-2 rounded-t-xl ${card}`} />
      <div className={`relative mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full ${badge}`}>
        {icon}
      </div>
      <div className="relative mb-1.5 text-[11px] tracking-wide text-ink-muted">{label}</div>
      <div className={`relative font-display text-2xl font-semibold sm:text-[30px] ${valueClass ?? ''}`}>{value}</div>
    </>
  )
  const className =
    'group relative block w-full overflow-hidden rounded-xl border border-line bg-panel p-4 pt-6 text-center shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-line-soft hover:shadow-lg'

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  )
}
