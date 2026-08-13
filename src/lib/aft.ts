import { supabase } from './supabaseClient'
import { flagForDate, daysUntil, type ExpirationFlag } from './expirations'
import { toLocalDateString } from './dates'
import type { AftRunEventType, AftResult, AftStandard, AftTest } from '../types/database'

export const AFT_STANDARD_LABEL: Record<AftStandard, string> = {
  combat: 'Combat',
  general: 'General',
}

export const AFT_RUN_EVENT_LABEL: Record<AftRunEventType, string> = {
  two_mile_run: '2-Mile Run',
  row_5k: '5K Row',
  swim_1k: '1K Swim',
  bike_12k: '12K Bike',
  walk_2_5mi: '2.5 Mile Walk',
}

export const AFT_RESULT_LABEL: Record<AftResult, string> = {
  go: 'GO',
  nogo: 'NO-GO',
}

// The Army requires an AFT roughly twice a year -- used to flag soldiers
// overdue/coming due the same way ETS/CAC/NCOER dates already are.
export const AFT_CYCLE_DAYS = 180
export const AFT_WARNING_DAYS = 30

export function aftDueDate(lastTestDate: string): string {
  const due = new Date(`${lastTestDate}T00:00:00`)
  due.setDate(due.getDate() + AFT_CYCLE_DAYS)
  return toLocalDateString(due)
}

export function aftFlag(lastTestDate: string | null): { flag: ExpirationFlag; days: number | null } {
  if (!lastTestDate) return { flag: null, days: null }
  const due = aftDueDate(lastTestDate)
  return { flag: flagForDate(due, AFT_WARNING_DAYS), days: daysUntil(due) }
}

export async function listAftTests() {
  const { data, error } = await supabase.from('aft_tests').select('*').order('test_date', { ascending: false })
  if (error) throw error
  return data as AftTest[]
}

// Used both from a Soldier's own read-only view and from admin's SoldierDetail
// page -- RLS decides what each caller can actually see, this just filters
// by soldier_id either way.
export async function listAftTestsForSoldier(soldierId: string) {
  const { data, error } = await supabase
    .from('aft_tests')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('test_date', { ascending: false })
  if (error) throw error
  return data as AftTest[]
}

export interface AftTestInput {
  soldierId: string
  testDate: string
  standard: AftStandard
  aocMos?: string | null
  rankAtTest?: string | null
  age?: number | null
  deadliftLbs?: number | null
  deadliftPoints?: number | null
  pushupReps?: number | null
  pushupPoints?: number | null
  sdcTime?: string | null
  sdcPoints?: number | null
  plankTime?: string | null
  plankPoints?: number | null
  runEventType: AftRunEventType
  runEventTime?: string | null
  runEventPoints?: number | null
  totalPoints?: number | null
  overallResult?: AftResult | null
}

function toPayload(input: AftTestInput) {
  return {
    soldier_id: input.soldierId,
    test_date: input.testDate,
    standard: input.standard,
    aoc_mos: input.aocMos || null,
    rank_at_test: input.rankAtTest || null,
    age: input.age ?? null,
    deadlift_lbs: input.deadliftLbs ?? null,
    deadlift_points: input.deadliftPoints ?? null,
    pushup_reps: input.pushupReps ?? null,
    pushup_points: input.pushupPoints ?? null,
    sdc_time: input.sdcTime || null,
    sdc_points: input.sdcPoints ?? null,
    plank_time: input.plankTime || null,
    plank_points: input.plankPoints ?? null,
    run_event_type: input.runEventType,
    run_event_time: input.runEventTime || null,
    run_event_points: input.runEventPoints ?? null,
    total_points: input.totalPoints ?? null,
    overall_result: input.overallResult || null,
  }
}

export async function createAftTest(input: AftTestInput, createdBy: string) {
  const { data, error } = await supabase
    .from('aft_tests')
    .insert({ ...toPayload(input), created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data as AftTest
}

export async function updateAftTest(id: string, input: AftTestInput) {
  const { data, error } = await supabase.from('aft_tests').update(toPayload(input)).eq('id', id).select().single()
  if (error) throw error
  return data as AftTest
}

export async function deleteAftTest(id: string) {
  const { error } = await supabase.from('aft_tests').delete().eq('id', id)
  if (error) throw error
}
