import { supabase } from './supabaseClient'

export async function enrollTotp() {
  // Supabase only returns the QR code/secret at the moment of enrollment, and
  // refuses to create a second factor while an unverified one from a prior
  // attempt is still sitting on the account (e.g. an interrupted enrollment,
  // or the enrollment effect firing twice) -- "friendly name already exists".
  // Clear any stale unverified factor first so enrollment can't get stuck.
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw listError
  const stale = existing.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified')
  for (const factor of stale) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
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
