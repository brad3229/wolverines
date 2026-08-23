import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { listSoldiers } from '../../lib/soldiers'
import { listDrillEvents, formatEventDateRange } from '../../lib/drillEvents'
import { listAttendanceForEvent } from '../../lib/attendance'
import { listEditRequests, reviewEditRequest, coerceEditRequestValue, formatEditRequestValue } from '../../lib/editRequests'
import { updateSoldier } from '../../lib/soldiers'
import { getExpiringSoldiers } from '../../lib/expirations'
import { listAftTests } from '../../lib/aft'
import { computeReadinessSummary } from '../../lib/readiness'
import { listReadinessSnapshots, upsertCurrentMonthSnapshot } from '../../lib/readinessSnapshots'
import { errorMessage } from '../../lib/errors'
import { notify } from '../../lib/notifications'
import { todayLocalDateString, formatMonthLabel } from '../../lib/dates'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import { IconRoster, IconCalendar, IconInbox, IconAttendance, IconAlertTriangle, IconEvaluation } from '../../components/icons'
import type { DrillEvent, EditRequest, ReadinessSnapshot, Soldier } from '../../types/database'

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
  const [readinessSnapshots, setReadinessSnapshots] = useState<ReadinessSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    setLoadError(null)
    Promise.all([listSoldiers(), listDrillEvents(), listEditRequests(), listAftTests()])
      .then(([soldierData, eventData, requestData, aftTests]) => {
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

        // Keeps this month's readiness snapshot live all month; past months are never
        // touched again once the calendar rolls past them -- see readinessSnapshots.ts.
        const summary = computeReadinessSummary(soldierData, aftTests)
        upsertCurrentMonthSnapshot(summary)
          .then(listReadinessSnapshots)
          .then(setReadinessSnapshots)
          .catch((err) => setLoadError(errorMessage(err, 'Failed to load unit readiness history')))
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
          <UnitReadinessCard snapshots={readinessSnapshots} />

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

function ReadinessTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; pct: number } }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface-raised px-3 py-2 shadow-lg">
      <div className="font-display text-sm font-bold text-ink">{point.pct}%</div>
      <div className="text-[11px] text-ink-muted">{point.label}</div>
    </div>
  )
}

// Monthly unit deployability trend -- see lib/readinessSnapshots.ts for how these
// rows get captured. Renders the hero % (and month-over-month delta) unconditionally
// once there's at least one snapshot, but only draws the trend line once there are
// two or more -- a single point has no shape to show, so it gets an honest caption
// instead of a one-dot chart.
function UnitReadinessCard({ snapshots }: { snapshots: ReadinessSnapshot[] }) {
  if (snapshots.length === 0) return null

  const chartData = snapshots.map((s) => ({ month: s.month, label: formatMonthLabel(s.month), pct: s.deployable_pct }))
  const current = chartData[chartData.length - 1]
  const previous = chartData.length >= 2 ? chartData[chartData.length - 2] : null
  const delta = previous ? current.pct - previous.pct : null

  return (
    <div className="mb-7 rounded-xl border border-line bg-panel p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-ink-faint">UNIT READINESS</span>
        <Link to="/admin/readiness" className="text-xs font-semibold text-accent-soft-ink hover:underline">
          View Readiness Matrix &rarr;
        </Link>
      </div>
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="font-display text-4xl font-bold text-accent">{current.pct}%</span>
        {delta !== null && delta !== 0 && (
          <span className={`text-sm font-semibold ${delta > 0 ? 'text-good-ink' : 'text-bad-ink'}`}>
            {delta > 0 ? '+' : ''}
            {delta}% this month
          </span>
        )}
      </div>
      {chartData.length >= 2 ? (
        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-ink-faint)', fontSize: 11 }} />
              <Tooltip content={<ReadinessTooltip />} cursor={{ stroke: 'var(--color-line)' }} />
              <Area type="monotone" dataKey="pct" stroke="var(--color-accent)" strokeWidth={2} fill="url(#readinessFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">Come back next month to see the trend.</p>
      )}
    </div>
  )
}
