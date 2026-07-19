import { supabase } from './supabaseClient'
import type { EditRequest, Soldier } from '../types/database'

// Boolean-backed soldier fields are stored on edit_requests as the text 'true'/'false'
// (old_value/new_value are text columns shared by every field type) -- these two helpers
// keep the string<->boolean conversion in one place instead of repeating it at every
// approval/display call site.
const BOOLEAN_FIELDS = new Set<string>(['receives_drill_pay'])

export function coerceEditRequestValue(fieldName: string, value: string): Partial<Soldier>[keyof Soldier] {
  return BOOLEAN_FIELDS.has(fieldName) ? value === 'true' : value
}

export function formatEditRequestValue(fieldName: string, value: string | null) {
  if (value === null) return '—'
  return BOOLEAN_FIELDS.has(fieldName) ? (value === 'true' ? 'Yes' : 'No') : value
}

export async function listEditRequests() {
  const { data, error } = await supabase
    .from('edit_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data as EditRequest[]
}

export async function listOwnEditRequests(soldierId: string) {
  const { data, error } = await supabase
    .from('edit_requests')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data as EditRequest[]
}

export async function submitEditRequest(params: {
  soldierId: string
  fieldName: string
  oldValue: string | null
  newValue: string
}) {
  const { data, error } = await supabase
    .from('edit_requests')
    .insert({
      soldier_id: params.soldierId,
      field_name: params.fieldName,
      old_value: params.oldValue,
      new_value: params.newValue,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data as EditRequest
}

export async function reviewEditRequest(params: {
  id: string
  approve: boolean
  reviewedBy: string
}) {
  const { data, error } = await supabase
    .from('edit_requests')
    .update({
      status: params.approve ? 'approved' : 'rejected',
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as EditRequest
}
