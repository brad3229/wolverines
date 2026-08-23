import { supabase } from './supabaseClient'
import { currentMonthLocalDateString } from './dates'
import type { ReadinessSnapshot } from '../types/database'
import type { ReadinessSummary } from './readiness'

export async function listReadinessSnapshots() {
  const { data, error } = await supabase.from('readiness_snapshots').select('*').order('month', { ascending: true })
  if (error) throw error
  return data as ReadinessSnapshot[]
}

// Upserted every time an admin loads the Dashboard, keyed on the calendar month --
// this keeps the current month's number live all month long, while every past
// month's row simply stops getting touched once the month rolls over, freezing
// it as real history. Never called for any month but the current one, so there's
// no path that backfills or estimates a month nobody actually observed.
export async function upsertCurrentMonthSnapshot(summary: ReadinessSummary) {
  const { error } = await supabase.from('readiness_snapshots').upsert(
    {
      month: currentMonthLocalDateString(),
      deployable_pct: summary.pct,
      go_count: summary.goCount,
      at_risk_count: summary.atRiskCount,
      no_go_count: summary.noGoCount,
      total_count: summary.total,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'month' },
  )
  if (error) throw error
}
