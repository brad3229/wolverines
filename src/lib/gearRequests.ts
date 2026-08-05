import { supabase } from './supabaseClient'
import type { GearRequest, GearRequestCategory } from '../types/database'

export const GEAR_CATEGORY_LABEL: Record<GearRequestCategory, string> = {
  initial_issue: 'Initial Issue (New Soldier)',
  missing_lost: 'Missing / Lost',
  damaged: 'Damaged / Worn Out',
  wrong_size: 'Wrong Size',
  other: 'Other',
}

export async function listGearRequests() {
  const { data, error } = await supabase
    .from('gear_requests')
    .select('*')
    .order('reported_at', { ascending: false })
  if (error) throw error
  return data as GearRequest[]
}

export async function listOwnGearRequests(soldierId: string) {
  const { data, error } = await supabase
    .from('gear_requests')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('reported_at', { ascending: false })
  if (error) throw error
  return data as GearRequest[]
}

export async function submitGearRequest(params: { soldierId: string; category: GearRequestCategory; description: string }) {
  const { data, error } = await supabase
    .from('gear_requests')
    .insert({
      soldier_id: params.soldierId,
      category: params.category,
      description: params.description,
      status: 'open',
    })
    .select()
    .single()
  if (error) throw error
  return data as GearRequest
}

export async function markGearRequestInProgress(params: { id: string }) {
  const { data, error } = await supabase
    .from('gear_requests')
    .update({ status: 'in_progress' })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as GearRequest
}

export async function resolveGearRequest(params: { id: string; resolvedBy: string; notes: string }) {
  const { data, error } = await supabase
    .from('gear_requests')
    .update({
      status: 'resolved',
      resolved_by: params.resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_notes: params.notes || null,
    })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as GearRequest
}

