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
import type { AftRunEventType, AftStandard, Sex } from '../types/database'

// The source tables give one column pair per age band, labeled "M | C" and
// "F". Confirmed: for Combat standard (the 21 designated combat MOSs --
// infantry, armor, cavalry, artillery, Special Forces, etc.), scoring is
// sex-neutral -- women use the exact same "M|C" column as men, same
// thresholds, same points, no adjustment. Only General standard splits by
// sex. So the column depends on standard first, sex second.
const AGE_BAND_MIN = [17, 22, 27, 32, 37, 42, 47, 52, 57, 62]

export function ageBandIndex(age: number): number {
  for (let i = AGE_BAND_MIN.length - 1; i >= 0; i--) {
    if (age >= AGE_BAND_MIN[i]) return i
  }
  return 0
}

function columnIndex(ageBandIdx: number, sex: Sex, standard: AftStandard): number {
  const useMaleColumn = standard === 'combat' || sex === 'male'
  return ageBandIdx * 2 + (useMaleColumn ? 0 : 1)
}

// Scans rows top-down (already sorted 100 -> 0 in the source) and returns the
// highest points level the raw value satisfies. `higherIsBetter` is true for
// deadlift (lbs) and push-up (reps); false for the timed events (a lower
// time is better, so the row's threshold is a maximum, not a minimum).
function lookupPoints(
  table: AftScoreRow[],
  ageBandIdx: number,
  sex: Sex,
  standard: AftStandard,
  rawValue: number,
  higherIsBetter: boolean,
): number {
  const col = columnIndex(ageBandIdx, sex, standard)
  for (const row of table) {
    const [points, ...values] = row
    const threshold = values[col]
    if (threshold === null) continue
    if (higherIsBetter ? rawValue >= threshold : rawValue <= threshold) return points
  }
  return 0
}

export function deadliftPoints(lbs: number, age: number, sex: Sex, standard: AftStandard): number {
  return lookupPoints(DEADLIFT_TABLE, ageBandIndex(age), sex, standard, lbs, true)
}

export function pushupPoints(reps: number, age: number, sex: Sex, standard: AftStandard): number {
  return lookupPoints(PUSHUP_TABLE, ageBandIndex(age), sex, standard, reps, true)
}

export function sdcPoints(seconds: number, age: number, sex: Sex, standard: AftStandard): number {
  return lookupPoints(SDC_TABLE_SECONDS, ageBandIndex(age), sex, standard, seconds, false)
}

// Unlike SDC/run, plank is "hold as long as possible" -- a longer time is
// better, so (unusually for a timed event) this uses higherIsBetter=true.
export function plankPoints(seconds: number, age: number, sex: Sex, standard: AftStandard): number {
  return lookupPoints(PLANK_TABLE_SECONDS, ageBandIndex(age), sex, standard, seconds, true)
}

export function runPoints(seconds: number, age: number, sex: Sex, standard: AftStandard): number {
  return lookupPoints(RUN_TABLE_SECONDS, ageBandIndex(age), sex, standard, seconds, false)
}

// The alternate aerobic events (row/swim/bike/walk) have no points scale --
// just a single GO/NO-GO time cutoff per age band and sex.
export function alternateEventResult(
  eventType: Exclude<AftRunEventType, 'two_mile_run'>,
  seconds: number,
  age: number,
  sex: Sex,
  standard: AftStandard,
): 'go' | 'nogo' | null {
  const col = columnIndex(ageBandIndex(age), sex, standard)
  const cutoff = ALTERNATE_EVENT_CUTOFF_SECONDS[eventType]?.[col]
  if (cutoff == null) return null
  return seconds <= cutoff ? 'go' : 'nogo'
}

// The 2-mile run scores on the same 0-100 graduated scale as the other
// events; an alternate aerobic event (row/swim/bike/walk) instead only
// yields a flat 60 (GO) or 0 (NO-GO) -- matching the "POINTS (60/0)" label
// printed directly on that section of the DA 705-AFT scorecard.
export function runEventPoints(
  eventType: AftRunEventType,
  seconds: number,
  age: number,
  sex: Sex,
  standard: AftStandard,
): number | null {
  if (eventType === 'two_mile_run') return runPoints(seconds, age, sex, standard)
  const result = alternateEventResult(eventType, seconds, age, sex, standard)
  if (result === null) return null
  return result === 'go' ? 60 : 0
}

// Every event needs at least 60 points to pass on its own -- fail one event
// and the whole test is a NO-GO regardless of total. The minimum total is
// then 300 (General) or 350 (Combat). Returns null (not yet determinable)
// until every event has a score.
export function overallAftResult(
  standard: AftStandard,
  eventPoints: (number | null)[],
): 'go' | 'nogo' | null {
  if (eventPoints.some((p) => p == null)) return null
  const scores = eventPoints as number[]
  const total = scores.reduce((sum, p) => sum + p, 0)
  const minTotal = standard === 'combat' ? 350 : 300
  return scores.every((p) => p >= 60) && total >= minTotal ? 'go' : 'nogo'
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
