import { supabase } from './supabaseClient'
import type { UserRole } from '../types/database'

export async function getProfileRole(profileId: string) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', profileId).single()
  if (error) throw error
  return data.role as UserRole
}
