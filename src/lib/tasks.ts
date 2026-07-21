import { supabase } from './supabaseClient'
import type { TaskList, TaskItem, SoldierTaskCompletion } from '../types/database'

export async function listTaskLists() {
  const { data, error } = await supabase.from('task_lists').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as TaskList[]
}

export async function listActiveTaskLists() {
  const { data, error } = await supabase
    .from('task_lists')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as TaskList[]
}

export async function getTaskList(id: string) {
  const { data, error } = await supabase.from('task_lists').select('*').eq('id', id).single()
  if (error) throw error
  return data as TaskList
}

export async function createTaskList(params: { name: string; description: string | null; createdBy: string }) {
  const { data, error } = await supabase
    .from('task_lists')
    .insert({ name: params.name, description: params.description, created_by: params.createdBy })
    .select()
    .single()
  if (error) throw error
  return data as TaskList
}

export async function updateTaskList(id: string, updates: Partial<Pick<TaskList, 'name' | 'description' | 'active'>>) {
  const { data, error } = await supabase.from('task_lists').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as TaskList
}

export async function deleteTaskList(id: string) {
  const { error } = await supabase.from('task_lists').delete().eq('id', id)
  if (error) throw error
}

export async function listTaskItems(taskListId: string) {
  const { data, error } = await supabase
    .from('task_items')
    .select('*')
    .eq('task_list_id', taskListId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as TaskItem[]
}

export async function createTaskItem(params: { taskListId: string; label: string; sortOrder: number }) {
  const { data, error } = await supabase
    .from('task_items')
    .insert({ task_list_id: params.taskListId, label: params.label, sort_order: params.sortOrder })
    .select()
    .single()
  if (error) throw error
  return data as TaskItem
}

export async function updateTaskItem(id: string, updates: Partial<Pick<TaskItem, 'label' | 'sort_order'>>) {
  const { data, error } = await supabase.from('task_items').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as TaskItem
}

export async function deleteTaskItem(id: string) {
  const { error } = await supabase.from('task_items').delete().eq('id', id)
  if (error) throw error
}

export async function reorderTaskItems(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, index) => updateTaskItem(id, { sort_order: index })))
}

export async function listCompletionsForList(taskListId: string) {
  const items = await listTaskItems(taskListId)
  if (items.length === 0) return []
  const { data, error } = await supabase
    .from('soldier_task_completions')
    .select('*')
    .in(
      'task_item_id',
      items.map((i) => i.id),
    )
  if (error) throw error
  return data as SoldierTaskCompletion[]
}

export async function listOwnCompletions(soldierId: string) {
  const { data, error } = await supabase.from('soldier_task_completions').select('*').eq('soldier_id', soldierId)
  if (error) throw error
  return data as SoldierTaskCompletion[]
}

export async function reportOwnCompletion(params: { soldierId: string; taskItemId: string; reportedBy: string }) {
  const { data, error } = await supabase
    .from('soldier_task_completions')
    .upsert(
      {
        soldier_id: params.soldierId,
        task_item_id: params.taskItemId,
        status: 'self_reported',
        reported_by: params.reportedBy,
        reported_at: new Date().toISOString(),
        verified_by: null,
        verified_at: null,
      },
      { onConflict: 'soldier_id,task_item_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as SoldierTaskCompletion
}

export async function retractOwnCompletion(params: { soldierId: string; taskItemId: string }) {
  const { data, error } = await supabase
    .from('soldier_task_completions')
    .upsert(
      {
        soldier_id: params.soldierId,
        task_item_id: params.taskItemId,
        status: 'incomplete',
        reported_by: null,
        reported_at: null,
        verified_by: null,
        verified_at: null,
      },
      { onConflict: 'soldier_id,task_item_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as SoldierTaskCompletion
}

export async function verifyCompletion(params: { soldierId: string; taskItemId: string; verifiedBy: string }) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('soldier_task_completions')
    .upsert(
      {
        soldier_id: params.soldierId,
        task_item_id: params.taskItemId,
        status: 'verified',
        reported_by: params.verifiedBy,
        reported_at: now,
        verified_by: params.verifiedBy,
        verified_at: now,
      },
      { onConflict: 'soldier_id,task_item_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as SoldierTaskCompletion
}

export async function resetCompletion(params: { soldierId: string; taskItemId: string }) {
  const { data, error } = await supabase
    .from('soldier_task_completions')
    .upsert(
      {
        soldier_id: params.soldierId,
        task_item_id: params.taskItemId,
        status: 'incomplete',
        reported_by: null,
        reported_at: null,
        verified_by: null,
        verified_at: null,
      },
      { onConflict: 'soldier_id,task_item_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as SoldierTaskCompletion
}

export async function countPendingTaskVerifications() {
  const { count, error } = await supabase
    .from('soldier_task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'self_reported')
  if (error) throw error
  return count ?? 0
}
