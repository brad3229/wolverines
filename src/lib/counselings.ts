import { supabase } from './supabaseClient'
import type { Counseling } from '../types/database'

export async function listCounselings() {
  const { data, error } = await supabase.from('counselings').select('*').order('session_date', { ascending: false })
  if (error) throw error
  return data as Counseling[]
}

// Used both from a Soldier's own read-only view and from admin's SoldierDetail
// page -- RLS decides what each caller can actually see, this just filters
// by soldier_id either way.
export async function listCounselingsForSoldier(soldierId: string) {
  const { data, error } = await supabase
    .from('counselings')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('session_date', { ascending: false })
  if (error) throw error
  return data as Counseling[]
}

export interface CounselingInput {
  soldierId: string
  sessionDate: string
  organization: string
  counselorName: string
  purpose: string
  keyPoints: string
  planOfAction: string
  leaderResponsibilities?: string | null
  individualRemarks?: string | null
  assessment?: string | null
}

function toPayload(input: CounselingInput) {
  return {
    soldier_id: input.soldierId,
    session_date: input.sessionDate,
    organization: input.organization,
    counselor_name: input.counselorName,
    purpose: input.purpose,
    key_points: input.keyPoints,
    plan_of_action: input.planOfAction,
    leader_responsibilities: input.leaderResponsibilities || null,
    individual_remarks: input.individualRemarks || null,
    assessment: input.assessment || null,
  }
}

export async function createCounseling(input: CounselingInput, createdBy: string) {
  const { data, error } = await supabase
    .from('counselings')
    .insert({ ...toPayload(input), created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data as Counseling
}

export async function updateCounseling(id: string, input: CounselingInput) {
  const { data, error } = await supabase.from('counselings').update(toPayload(input)).eq('id', id).select().single()
  if (error) throw error
  return data as Counseling
}

export async function deleteCounseling(id: string) {
  const { error } = await supabase.from('counselings').delete().eq('id', id)
  if (error) throw error
}
