import { supabase } from './supabaseClient'
import type { DrillEvent, DrillEventType } from '../types/database'

export const EVENT_TYPE_LABEL: Record<DrillEventType, string> = {
  drill: 'Drill',
  annual_training: 'Annual Training',
}

export function formatEventDateRange(event: DrillEvent) {
  return event.end_date === event.event_date ? event.event_date : `${event.event_date} – ${event.end_date}`
}

export async function listDrillEvents() {
  const { data, error } = await supabase
    .from('drill_events')
    .select('*')
    .order('event_date', { ascending: true })
  if (error) throw error
  return data as DrillEvent[]
}

export async function getDrillEvent(id: string) {
  const { data, error } = await supabase.from('drill_events').select('*').eq('id', id).single()
  if (error) throw error
  return data as DrillEvent
}

export async function createDrillEvent(event: Partial<DrillEvent>) {
  const { data, error } = await supabase.from('drill_events').insert(event).select().single()
  if (error) throw error
  return data as DrillEvent
}

export async function updateDrillEvent(id: string, updates: Partial<DrillEvent>) {
  const { data, error } = await supabase
    .from('drill_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as DrillEvent
}

export function isEventOpenForCheckIn(event: DrillEvent) {
  const today = new Date().toISOString().slice(0, 10)
  return event.event_date <= today && today <= event.end_date
}
