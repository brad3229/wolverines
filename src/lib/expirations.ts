import type { Soldier } from '../types/database'

export const CAC_WARNING_DAYS = 30
export const ETS_WARNING_DAYS = 90

export type ExpirationFlag = 'expired' | 'soon' | null

export function daysUntil(dateStr: string): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`)
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / msPerDay)
}

export function flagForDate(dateStr: string | null, warningDays: number): ExpirationFlag {
  if (!dateStr) return null
  const days = daysUntil(dateStr)
  if (days < 0) return 'expired'
  if (days <= warningDays) return 'soon'
  return null
}

export interface SoldierExpiration {
  soldier: Soldier
  etsFlag: ExpirationFlag
  etsDays: number | null
  cacFlag: ExpirationFlag
  cacDays: number | null
}

export function getExpiringSoldiers(soldiers: Soldier[]): SoldierExpiration[] {
  return soldiers
    .filter((s) => s.status === 'active')
    .map((s) => ({
      soldier: s,
      etsFlag: flagForDate(s.ets_date, ETS_WARNING_DAYS),
      etsDays: s.ets_date ? daysUntil(s.ets_date) : null,
      cacFlag: flagForDate(s.cac_expiration_date, CAC_WARNING_DAYS),
      cacDays: s.cac_expiration_date ? daysUntil(s.cac_expiration_date) : null,
    }))
    .filter((r) => r.etsFlag !== null || r.cacFlag !== null)
    .sort((a, b) => {
      const aMin = Math.min(a.etsFlag ? (a.etsDays ?? Infinity) : Infinity, a.cacFlag ? (a.cacDays ?? Infinity) : Infinity)
      const bMin = Math.min(b.etsFlag ? (b.etsDays ?? Infinity) : Infinity, b.cacFlag ? (b.cacDays ?? Infinity) : Infinity)
      return aMin - bMin
    })
}
