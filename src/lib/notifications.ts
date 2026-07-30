import { supabase } from './supabaseClient'
import type { Notification } from '../types/database'

export async function listOwnNotifications(profileId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as Notification[]
}

export async function countUnreadNotifications(profileId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('read', false)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(profileId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('profile_id', profileId)
    .eq('read', false)
  if (error) throw error
}

// Fire-and-forget from the admin actions that review a Soldier's submission -- notification
// delivery is a nice-to-have, never worth blocking or failing the underlying action over.
export async function notify(params: { profileId: string | null | undefined; title: string; body: string; link?: string }) {
  if (!params.profileId) return
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({ profile_id: params.profileId, title: params.title, body: params.body, link: params.link ?? null })
    if (error) throw error
  } catch {
    // Swallow -- the reviewing admin's action already succeeded; losing a notification
    // isn't worth surfacing an error for.
  }
}
