import { supabase } from './supabaseClient'
import { functionErrorMessage } from './errors'
import type { UserRole } from '../types/database'

export async function inviteSoldierAccount(params: { email: string; soldierId: string }) {
  // Supabase's invite email redirects here after the recipient clicks it -- pass the
  // app's own current origin/base so the invite lands back on this deployment (GitHub
  // Pages, a preview URL, or localhost during dev) instead of the project's default
  // Site URL. This exact URL must also be added to Supabase's Auth > URL Configuration
  // > Redirect URLs allow list, or Supabase will refuse the redirect.
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { data, error } = await supabase.functions.invoke('invite-soldier', {
    body: { email: params.email, soldierId: params.soldierId, redirectTo },
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
