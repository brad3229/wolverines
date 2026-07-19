import { supabase } from './supabaseClient'
import type { Soldier } from '../types/database'

export async function listSoldiers() {
  const { data, error } = await supabase
    .from('soldiers')
    .select('*')
    .order('last_name', { ascending: true })
  if (error) throw error
  return data as Soldier[]
}

export async function getSoldier(id: string) {
  const { data, error } = await supabase.from('soldiers').select('*').eq('id', id).single()
  if (error) throw error
  return data as Soldier
}

export async function getOwnSoldierRecord(profileId: string) {
  const { data, error } = await supabase
    .from('soldiers')
    .select('*')
    .eq('profile_id', profileId)
    .single()
  if (error) throw error
  return data as Soldier
}

export async function createSoldier(soldier: Partial<Soldier>) {
  const { data, error } = await supabase.from('soldiers').insert(soldier).select().single()
  if (error) throw error
  return data as Soldier
}

export async function updateSoldier(id: string, updates: Partial<Soldier>) {
  const { data, error } = await supabase
    .from('soldiers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Soldier
}
