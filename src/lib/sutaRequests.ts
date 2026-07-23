import { supabase } from './supabaseClient'
import type { SutaRequest } from '../types/database'

export async function listSutaRequests() {
  const { data, error } = await supabase
    .from('suta_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data as SutaRequest[]
}

export async function listOwnSutaRequests(soldierId: string) {
  const { data, error } = await supabase
    .from('suta_requests')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data as SutaRequest[]
}

export async function submitSutaRequest(params: {
  soldierId: string
  drillEventId: string
  reason: string
  requestedMakeupDate?: string | null
}) {
  const { data, error } = await supabase
    .from('suta_requests')
    .insert({
      soldier_id: params.soldierId,
      drill_event_id: params.drillEventId,
      reason: params.reason,
      status: 'pending',
      requested_makeup_date: params.requestedMakeupDate || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as SutaRequest
}

export async function reviewSutaRequest(params: { id: string; approve: boolean; reviewedBy: string }) {
  const { data, error } = await supabase
    .from('suta_requests')
    .update({
      status: params.approve ? 'approved' : 'denied',
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      makeup_status: params.approve ? 'pending' : 'not_required',
    })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as SutaRequest
}

export async function markMakeupComplete(params: { id: string; notes: string }) {
  const { data, error } = await supabase
    .from('suta_requests')
    .update({
      makeup_status: 'completed',
      makeup_notes: params.notes || null,
      makeup_completed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as SutaRequest
}
