import { supabase } from './supabaseClient'
import type { PayIssue, PayIssueCategory } from '../types/database'

export async function listPayIssues() {
  const { data, error } = await supabase
    .from('pay_issues')
    .select('*')
    .order('reported_at', { ascending: false })
  if (error) throw error
  return data as PayIssue[]
}

export async function listOwnPayIssues(soldierId: string) {
  const { data, error } = await supabase
    .from('pay_issues')
    .select('*')
    .eq('soldier_id', soldierId)
    .order('reported_at', { ascending: false })
  if (error) throw error
  return data as PayIssue[]
}

export async function submitPayIssue(params: { soldierId: string; category: PayIssueCategory; description: string }) {
  const { data, error } = await supabase
    .from('pay_issues')
    .insert({
      soldier_id: params.soldierId,
      category: params.category,
      description: params.description,
      status: 'open',
    })
    .select()
    .single()
  if (error) throw error
  return data as PayIssue
}

export async function markPayIssueInProgress(params: { id: string }) {
  const { data, error } = await supabase
    .from('pay_issues')
    .update({ status: 'in_progress' })
    .eq('id', params.id)
    .select()
    .single()
  if (error) throw error
  return data as PayIssue
}

export async function resolvePayIssue(params: { id: string; resolvedBy: string; notes: string }) {
  const { data, error } = await supabase
    .from('pay_issues')
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
  return data as PayIssue
}
