import { supabase } from './supabaseClient'
import { functionErrorMessage } from './errors'
import type { UserRole } from '../types/database'

export async function inviteSoldierAccount(params: { email: string; soldierId: string }) {
  const { data, error } = await supabase.functions.invoke('invite-soldier', {
    body: { email: params.email, soldierId: params.soldierId },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'Failed to send invite'))
  return data as { profileId: string }
}

export async function setUserRole(params: { profileId: string; role: UserRole }) {
  const { data, error } = await supabase.functions.invoke('set-user-role', {
    body: { profileId: params.profileId, role: params.role },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'Failed to update role'))
  return data as { profileId: string; role: UserRole }
}
