import { supabase } from './supabaseClient'
import { flagForDate, daysUntil, type ExpirationFlag } from './expirations'
import { toLocalDateString } from './dates'
import type { WeaponsQualification, WeaponsQualRating, WeaponsQualTableType } from '../types/database'

export const WEAPONS_QUAL_TABLE_LABEL: Record<WeaponsQualTableType, string> = {
  practice: 'Table V (Practice)',
  qualification: 'Table VI (Qualification)',
}

export const WEAPONS_QUAL_RATING_LABEL: Record<WeaponsQualRating, string> = {
  expert: 'Expert',
  sharpshooter: 'Sharpshooter',
  marksman: 'Marksman',
  unqualified: 'Unqualified',
}

// Score bands straight off DA Form 7801 block 14 -- Stage I total hits (out of
// 40) map to one of four ratings, or null if there aren't enough hits entered
// yet to score.
export function qualificationRatingForTotal(total: number | null): WeaponsQualRating | null {
  if (total == null) return null
  if (total >= 36) return 'expert'
  if (total >= 30) return 'sharpshooter'
  if (total >= 23) return 'marksman'
  return 'unqualified'
}

// Same annual-cycle pattern as AFT: Soldiers requalify once a year, flagged
// the same way ETS/CAC/NCOER dates already are.
export const WEAPONS_QUAL_CYCLE_DAYS = 365
export const WEAPONS_QUAL_WARNING_DAYS = 30

export function weaponsQualDueDate(lastQualDate: string): string {
  const due = new Date(`${lastQualDate}T00:00:00`)
  due.setDate(due.getDate() + WEAPONS_QUAL_CYCLE_DAYS)
  return toLocalDateString(due)
}

export function weaponsQualFlag(lastQualDate: string | null): { flag: ExpirationFlag; days: number | null } {
  if (!lastQualDate) return { flag: null, days: null }
  const due = weaponsQualDueDate(lastQualDate)
  return { flag: flagForDate(due, WEAPONS_QUAL_WARNING_DAYS), days: daysUntil(due) }
}

export async function listWeaponsQualifications() {
  const { data, error } = await supabase
    .from('weapons_qualifications')
    .select('*')
    .order('qual_date', { ascending: false })
  if (error) throw error
  return data as WeaponsQualification[]
}

// Used both from a Soldier's own read-only view and from admin's SoldierDetail
// page -- RLS decides what each caller can actually see, this just filters
// by soldier_id either way.
export async function listWeaponsQualificationsForSoldier(soldierId: string) {
  const { data, error } = await supabase
    .from('weapons_qualifications')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('qual_date', { ascending: false })
  if (error) throw error
  return data as WeaponsQualification[]
}

export interface WeaponsQualInput {
  soldierId: string
  qualDate: string
  weaponType: string
  equipmentOptics?: string | null
  laneFiringOrder?: string | null
  tableType: WeaponsQualTableType
  phase1Hits?: number | null
  phase2Hits?: number | null
  phase3Hits?: number | null
  phase4Hits?: number | null
  totalHits?: number | null
  qualificationRating?: WeaponsQualRating | null
  rangeOicName?: string | null
  remarks?: string | null
}

function toPayload(input: WeaponsQualInput) {
  return {
    soldier_id: input.soldierId,
    qual_date: input.qualDate,
    weapon_type: input.weaponType,
    equipment_optics: input.equipmentOptics || null,
    lane_firing_order: input.laneFiringOrder || null,
    table_type: input.tableType,
    phase1_hits: input.phase1Hits ?? null,
    phase2_hits: input.phase2Hits ?? null,
    phase3_hits: input.phase3Hits ?? null,
    phase4_hits: input.phase4Hits ?? null,
    total_hits: input.totalHits ?? null,
    qualification_rating: input.qualificationRating ?? null,
    range_oic_name: input.rangeOicName || null,
    remarks: input.remarks || null,
  }
}

export async function createWeaponsQualification(input: WeaponsQualInput, createdBy: string) {
  const { data, error } = await supabase
    .from('weapons_qualifications')
    .insert({ ...toPayload(input), created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data as WeaponsQualification
}

export async function updateWeaponsQualification(id: string, input: WeaponsQualInput) {
  const { data, error } = await supabase
    .from('weapons_qualifications')
    .update(toPayload(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as WeaponsQualification
}

export async function deleteWeaponsQualification(id: string) {
  const { error } = await supabase.from('weapons_qualifications').delete().eq('id', id)
  if (error) throw error
}
