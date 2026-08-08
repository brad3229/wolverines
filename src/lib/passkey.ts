import { supabase } from './supabaseClient'

export function browserSupportsPasskeys() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

// Requires an existing signed-in session -- this adds a passkey to the
// current account, it isn't a passwordless signup path.
export async function registerPasskey() {
  const { data, error } = await supabase.auth.registerPasskey()
  if (error) throw error
  return data
}

export async function signInWithPasskey() {
  const { data, error } = await supabase.auth.signInWithPasskey()
  if (error) throw error
  return data
}

export async function listPasskeys() {
  const { data, error } = await supabase.auth.passkey.list()
  if (error) throw error
  return data
}

export async function deletePasskey(passkeyId: string) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId })
  if (error) throw error
}
