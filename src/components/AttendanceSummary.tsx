import type { Attendance, Soldier } from '../types/database'

interface AttendanceSummaryProps {
  soldiers: Soldier[]
  records: Record<string, Attendance>
}

export function AttendanceSummary({ soldiers, records }: AttendanceSummaryProps) {
  let confirmedPresent = 0
  let confirmedLate = 0
  let absent = 0
  let excused = 0
  let selfReported = 0

  for (const s of soldiers) {
    const r = records[s.id]
    if (!r) continue
    const isClaimOnly = !r.confirmed_by && (r.status === 'present' || r.status === 'late')
    if (isClaimOnly) {
      selfReported++
      continue
    }
    if (r.status === 'present') confirmedPresent++
    else if (r.status === 'late') confirmedLate++
    else if (r.status === 'absent') absent++
    else if (r.status === 'excused') excused++
  }

  const onGround = confirmedPresent + confirmedLate
  const unmarked = soldiers.length - onGround - absent - excused - selfReported

  return (
    <div className="sticky top-0 z-10 mb-4 rounded-xl border border-line bg-panel/95 p-4 backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <div className="text-[11px] tracking-wide text-ink-muted">ON GROUND (CONFIRMED)</div>
          <div className="font-display text-3xl font-semibold text-good-ink">
            {onGround}
            <span className="text-base font-medium text-ink-muted"> / {soldiers.length}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-ink-muted">
            <span className="font-semibold text-warn-ink">{selfReported}</span> self-reported
          </span>
          <span className="text-ink-muted">
            <span className="font-semibold text-info-ink">{excused}</span> excused
          </span>
          <span className="text-ink-muted">
            <span className="font-semibold text-bad-ink">{absent}</span> absent
          </span>
          <span className="text-ink-muted">
            <span className="font-semibold text-ink-dim">{unmarked}</span> unmarked
          </span>
        </div>
      </div>
    </div>
  )
}
