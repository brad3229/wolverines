import { supabase } from './supabaseClient'
import type { UserRole } from '../types/database'

export async function getProfileRole(profileId: string) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', profileId).single()
  if (error) throw error
  return data.role as UserRole
}

export interface AdminProfile {
  id: string
}

// profiles has no name/email of its own -- callers cross-reference against
// the roster (soldiers.profile_id) to show something more useful than a
// bare UUID, same as SoldierDetail already does for account role lookups.
export async function listAdminProfiles() {
  const { data, error } = await supabase.from('profiles').select('id').eq('role', 'admin')
  if (error) throw error
  return data as AdminProfile[]
}
