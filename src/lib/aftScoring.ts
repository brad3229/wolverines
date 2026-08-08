import {
  AGE_BANDS,
  DEADLIFT_TABLE,
  PUSHUP_TABLE,
  SDC_TABLE_SECONDS,
  PLANK_TABLE_SECONDS,
  RUN_TABLE_SECONDS,
  ALTERNATE_EVENT_CUTOFF_SECONDS,
} from './aftScoreTables'
import type { AftScoreRow } from './aftScoreTables'
import type { AftRunEventType, Sex } from '../types/database'

// The source tables give one column pair per age band, labeled "M | C" and
// "F". The DA 705-AFT form itself only has a single STANDARD (Combat/General)
// checkbox per whole test, not per event -- so Standard is read here as
// affecting pass/fail minimums, not which raw-to-points column to use. "M|C"
// is treated as the Male column (same value regardless of Combat/General).
const AGE_BAND_MIN = [17, 22, 27, 32, 37, 42, 47, 52, 57, 62]

export function ageBandIndex(age: number): number {
  for (let i = AGE_BAND_MIN.length - 1; i >= 0; i--) {
    if (age >= AGE_BAND_MIN[i]) return i
  }
  return 0
}

function columnIndex(ageBandIdx: number, sex: Sex): number {
  return ageBandIdx * 2 + (sex === 'male' ? 0 : 1)
}

// Scans rows top-down (already sorted 100 -> 0 in the source) and returns the
// highest points level the raw value satisfies. `higherIsBetter` is true for
// deadlift (lbs) and push-up (reps); false for the timed events (a lower
// time is better, so the row's threshold is a maximum, not a minimum).
function lookupPoints(table: AftScoreRow[], ageBandIdx: number, sex: Sex, rawValue: number, higherIsBetter: boolean): number {
  const col = columnIndex(ageBandIdx, sex)
  for (const row of table) {
    const [points, ...values] = row
    const threshold = values[col]
    if (threshold === null) continue
    if (higherIsBetter ? rawValue >= threshold : rawValue <= threshold) return points
  }
  return 0
}

export function deadliftPoints(lbs: number, age: number, sex: Sex): number {
  return lookupPoints(DEADLIFT_TABLE, ageBandIndex(age), sex, lbs, true)
}

export function pushupPoints(reps: number, age: number, sex: Sex): number {
  return lookupPoints(PUSHUP_TABLE, ageBandIndex(age), sex, reps, true)
}

export function sdcPoints(seconds: number, age: number, sex: Sex): number {
  return lookupPoints(SDC_TABLE_SECONDS, ageBandIndex(age), sex, seconds, false)
}

// Unlike SDC/run, plank is "hold as long as possible" -- a longer time is
// better, so (unusually for a timed event) this uses higherIsBetter=true.
export function plankPoints(seconds: number, age: number, sex: Sex): number {
  return lookupPoints(PLANK_TABLE_SECONDS, ageBandIndex(age), sex, seconds, true)
}

export function runPoints(seconds: number, age: number, sex: Sex): number {
  return lookupPoints(RUN_TABLE_SECONDS, ageBandIndex(age), sex, seconds, false)
}

// The alternate aerobic events (row/swim/bike/walk) have no points scale --
// just a single GO/NO-GO time cutoff per age band and sex.
export function alternateEventResult(
  eventType: Exclude<AftRunEventType, 'two_mile_run'>,
  seconds: number,
  age: number,
  sex: Sex,
): 'go' | 'nogo' | null {
  const col = columnIndex(ageBandIndex(age), sex)
  const cutoff = ALTERNATE_EVENT_CUTOFF_SECONDS[eventType]?.[col]
  if (cutoff == null) return null
  return seconds <= cutoff ? 'go' : 'nogo'
}

// The 2-mile run scores on the same 0-100 graduated scale as the other
// events; an alternate aerobic event (row/swim/bike/walk) instead only
// yields a flat 60 (GO) or 0 (NO-GO) -- matching the "POINTS (60/0)" label
// printed directly on that section of the DA 705-AFT scorecard.
export function runEventPoints(eventType: AftRunEventType, seconds: number, age: number, sex: Sex): number | null {
  if (eventType === 'two_mile_run') return runPoints(seconds, age, sex)
  const result = alternateEventResult(eventType, seconds, age, sex)
  if (result === null) return null
  return result === 'go' ? 60 : 0
}

export { AGE_BANDS }

export function parseMmSsToSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d+):([0-5]\d)$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatSecondsToMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
