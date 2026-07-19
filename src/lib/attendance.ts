import { supabase } from './supabaseClient'
import { listDrillEvents } from './drillEvents'
import type { Attendance, AttendanceStatus, DrillEvent } from '../types/database'

export async function listAttendanceForEvent(drillEventId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('drill_event_id', drillEventId)
  if (error) throw error
  return data as Attendance[]
}

export async function listAttendanceForSoldier(soldierId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('marked_at', { ascending: false })
  if (error) throw error
  return data as Attendance[]
}

// Row-level highlight for admin attendance screens -- makes soldiers who need a look
// (self-reported, excused, absent, or never marked) jump out at a glance, distinct from
// the "nothing to do here" default for confirmed present/late.
export function attendanceRowClass(record: Attendance | null | undefined): string {
  if (!record) return 'border-line-soft border-dashed bg-panel'
  const isSelfReported = !record.confirmed_by && (record.status === 'present' || record.status === 'late')
  if (isSelfReported) return 'border-warn-border bg-warn-bg/10'
  if (record.status === 'excused') return 'border-info-border bg-info-bg/10'
  if (record.status === 'absent') return 'border-bad-border bg-bad-bg/10'
  return 'border-line bg-panel'
}

export interface AttendanceHistoryEntry {
  event: DrillEvent
  record: Attendance | null
}

export function attendanceBadge(record: Attendance | null): { label: string; className: string } {
  if (!record) return { label: 'NO RECORD', className: 'bg-neutral-bg text-neutral-ink' }
  if (!record.confirmed_by && (record.status === 'present' || record.status === 'late')) {
    return { label: 'UNCONFIRMED', className: 'bg-warn-bg text-warn-ink' }
  }
  switch (record.status) {
    case 'present':
      return { label: 'PRESENT', className: 'bg-good-bg text-good-ink' }
    case 'late':
      return { label: 'LATE', className: 'bg-warn-bg text-warn-ink' }
    case 'absent':
      return { label: 'ABSENT', className: 'bg-bad-bg text-bad-ink' }
    case 'excused':
      return { label: 'EXCUSED', className: 'bg-info-bg text-info-ink' }
  }
}

// Shared by the admin soldier-detail view and the Soldier's own Dashboard -- past drills
// matched to this Soldier's attendance record, plus a rate counting only cadre-confirmed
// present/late (excused drills don't count against them; self-reports that were never
// confirmed don't count for them either).
export async function getAttendanceHistory(
  soldierId: string,
): Promise<{ history: AttendanceHistoryEntry[]; rate: number | null }> {
  const [records, events] = await Promise.all([listAttendanceForSoldier(soldierId), listDrillEvents()])
  const today = new Date().toISOString().slice(0, 10)
  const pastEvents = [...events.filter((e) => e.end_date < today)].sort((a, b) =>
    a.event_date < b.event_date ? 1 : -1,
  )
  const recordByEvent = new Map(records.map((r) => [r.drill_event_id, r]))
  const history = pastEvents.map((event) => ({ event, record: recordByEvent.get(event.id) ?? null }))

  const applicable = history.filter((h) => h.record?.status !== 'excused')
  const attended = applicable.filter(
    (h) => !!h.record?.confirmed_by && (h.record.status === 'present' || h.record.status === 'late'),
  )
  const rate = applicable.length ? Math.round((attended.length / applicable.length) * 100) : null

  return { history, rate }
}

export async function markAttendance(params: {
  drillEventId: string
  soldierId: string
  status: AttendanceStatus
  reason?: string | null
  markedBy: string
  // True when an admin/NCO is confirming attendance in person (roll call). False (the
  // default) for a Soldier's own self check-in, which is a claim, not the official
  // record, until cadre confirms it.
  confirmed?: boolean
}) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        drill_event_id: params.drillEventId,
        soldier_id: params.soldierId,
        status: params.status,
        reason: params.reason ?? null,
        marked_by: params.markedBy,
        marked_at: now,
        confirmed_by: params.confirmed ? params.markedBy : null,
        confirmed_at: params.confirmed ? now : null,
      },
      { onConflict: 'drill_event_id,soldier_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as Attendance
}
