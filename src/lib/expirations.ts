import type { Soldier } from '../types/database'

export const CAC_WARNING_DAYS = 30
export const ETS_WARNING_DAYS = 90
export const NCOER_WARNING_DAYS = 90
export const NCOER_CYCLE_DAYS = 365

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

// NCOERs don't carry their own expiration date -- the next one is due one rating cycle
// after the last one was completed, so this derives a due date the same way flagForDate
// expects (an ISO date string) from `last_ncoer_date`.
export function ncoerDueDate(lastNcoerDate: string): string {
  const due = new Date(`${lastNcoerDate}T00:00:00`)
  due.setDate(due.getDate() + NCOER_CYCLE_DAYS)
  return due.toISOString().slice(0, 10)
}

export interface SoldierExpiration {
  soldier: Soldier
  etsFlag: ExpirationFlag
  etsDays: number | null
  cacFlag: ExpirationFlag
  cacDays: number | null
  ncoerFlag: ExpirationFlag
  ncoerDays: number | null
}

export function getExpiringSoldiers(soldiers: Soldier[]): SoldierExpiration[] {
  return soldiers
    .filter((s) => s.status === 'active')
    .map((s) => {
      const ncoerDue = s.is_nco && s.last_ncoer_date ? ncoerDueDate(s.last_ncoer_date) : null
      return {
        soldier: s,
        etsFlag: flagForDate(s.ets_date, ETS_WARNING_DAYS),
        etsDays: s.ets_date ? daysUntil(s.ets_date) : null,
        cacFlag: flagForDate(s.cac_expiration_date, CAC_WARNING_DAYS),
        cacDays: s.cac_expiration_date ? daysUntil(s.cac_expiration_date) : null,
        ncoerFlag: ncoerDue ? flagForDate(ncoerDue, NCOER_WARNING_DAYS) : null,
        ncoerDays: ncoerDue ? daysUntil(ncoerDue) : null,
      }
    })
    .filter((r) => r.etsFlag !== null || r.cacFlag !== null || r.ncoerFlag !== null)
    .sort((a, b) => {
      const aMin = Math.min(
        a.etsFlag ? (a.etsDays ?? Infinity) : Infinity,
        a.cacFlag ? (a.cacDays ?? Infinity) : Infinity,
        a.ncoerFlag ? (a.ncoerDays ?? Infinity) : Infinity,
      )
      const bMin = Math.min(
        b.etsFlag ? (b.etsDays ?? Infinity) : Infinity,
        b.cacFlag ? (b.cacDays ?? Infinity) : Infinity,
        b.ncoerFlag ? (b.ncoerDays ?? Infinity) : Infinity,
      )
      return aMin - bMin
    })
}
