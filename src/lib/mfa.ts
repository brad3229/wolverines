import { supabase } from './supabaseClient'

export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyFactor(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (verifyError) throw verifyError
}

export async function unenrollTotp(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

export async function listVerifiedTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data.totp.find((f) => f.status === 'verified') ?? null
}

export async function getAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return data
}
