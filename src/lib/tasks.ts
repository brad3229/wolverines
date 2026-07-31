import { supabase } from './supabaseClient'
import type { TaskList, TaskItem, SoldierTaskCompletion } from '../types/database'

export async function listTaskLists() {
  const { data, error } = await supabase.from('task_lists').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as TaskList[]
}

// Active lists visible to a specific Soldier -- platoon-wide lists (assigned_to_all) plus
// any list they've been individually/group-assigned to via task_list_assignments.
export async function listActiveTaskLists(soldierId: string) {
  const [{ data: lists, error: listsError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase.from('task_lists').select('*').eq('active', true).order('created_at', { ascending: false }),
    supabase.from('task_list_assignments').select('task_list_id').eq('soldier_id', soldierId),
  ])
  if (listsError) throw listsError
  if (assignmentsError) throw assignmentsError
  const assignedListIds = new Set((assignments ?? []).map((a) => a.task_list_id))
  return (lists as TaskList[]).filter((l) => l.assigned_to_all || assignedListIds.has(l.id))
}

export async function getTaskList(id: string) {
  const { data, error } = await supabase.from('task_lists').select('*').eq('id', id).single()
  if (error) throw error
  return data as TaskList
}

export async function createTaskList(params: {
  name: string
  description: string | null
  createdBy: string
  assignedToAll: boolean
  soldierIds?: string[]
}) {
  const { data, error } = await supabase
    .from('task_lists')
    .insert({
      name: params.name,
      description: params.description,
      created_by: params.createdBy,
      assigned_to_all: params.assignedToAll,
    })
    .select()
    .single()
  if (error) throw error
  if (!params.assignedToAll && params.soldierIds?.length) {
    await setTaskListAssignments(data.id, params.soldierIds)
  }
  return data as TaskList
}

export async function updateTaskList(
  id: string,
  updates: Partial<Pick<TaskList, 'name' | 'description' | 'active' | 'assigned_to_all'>>,
) {
  const { data, error } = await supabase.from('task_lists').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as TaskList
}

export async function listAssignedSoldierIds(taskListId: string) {
  const { data, error } = await supabase
    .from('task_list_assignments')
    .select('soldier_id')
    .eq('task_list_id', taskListId)
  if (error) throw error
  return data.map((row) => row.soldier_id) as string[]
}

// Replaces the full assignment set for a list -- simplest correct behavior for a "pick
// exactly these soldiers" UI, rather than diffing adds/removes. Any soldier dropped from
// the set also has their completion rows for this list's stations cleared, so stale
// progress doesn't silently reappear if they're ever re-assigned later.
export async function setTaskListAssignments(taskListId: string, soldierIds: string[]) {
  const { data: existing, error: existingError } = await supabase
    .from('task_list_assignments')
    .select('soldier_id')
    .eq('task_list_id', taskListId)
  if (existingError) throw existingError
  const newIds = new Set(soldierIds)
  const removedIds = (existing ?? []).map((row) => row.soldier_id).filter((id) => !newIds.has(id))

  const { error: deleteError } = await supabase.from('task_list_assignments').delete().eq('task_list_id', taskListId)
  if (deleteError) throw deleteError
  if (soldierIds.length > 0) {
    const { error: insertError } = await supabase
      .from('task_list_assignments')
      .insert(soldierIds.map((soldierId) => ({ task_list_id: taskListId, soldier_id: soldierId })))
    if (insertError) throw insertError
  }

  if (removedIds.length > 0) {
    const items = await listTaskItems(taskListId)
    if (items.length > 0) {
      const { error: cleanupError } = await supabase
        .from('soldier_task_completions')
        .delete()
        .in('soldier_id', removedIds)
        .in(
          'task_item_id',
          items.map((i) => i.id),
        )
      if (cleanupError) throw cleanupError
    }
  }
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

// Records why a soldier hasn't completed a station (e.g. "waiting on medical referral").
// Upserts a placeholder incomplete row if one doesn't exist yet purely to hold the note --
// PostgREST's upsert only touches the columns in this payload, so status/reported/verified
// on an existing row are left alone.
export async function setCompletionNotes(params: { soldierId: string; taskItemId: string; notes: string | null }) {
  const { data: existing } = await supabase
    .from('soldier_task_completions')
    .select('*')
    .eq('soldier_id', params.soldierId)
    .eq('task_item_id', params.taskItemId)
    .maybeSingle()

  const { data, error } = await supabase
    .from('soldier_task_completions')
    .upsert(
      {
        soldier_id: params.soldierId,
        task_item_id: params.taskItemId,
        status: existing?.status ?? 'incomplete',
        reported_by: existing?.reported_by ?? null,
        reported_at: existing?.reported_at ?? null,
        verified_by: existing?.verified_by ?? null,
        verified_at: existing?.verified_at ?? null,
        notes: params.notes,
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
