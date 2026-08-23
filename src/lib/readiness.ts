import { aftFlag } from './aft'
import type { AftTest, Soldier } from '../types/database'

type Tone = 'good' | 'warn' | 'bad'

function aftTone(latestAftDate: string | null): Tone {
  const { flag } = aftFlag(latestAftDate)
  if (flag === 'expired') return 'bad'
  if (flag === 'soon') return 'warn'
  return 'good'
}

function mrcTone(mrcStatus: Soldier['mrc_status']): Tone {
  if (mrcStatus === '4') return 'bad'
  if (mrcStatus === '3') return 'warn'
  return 'good'
}

export interface ReadinessSummary {
  total: number
  goCount: number
  atRiskCount: number
  noGoCount: number
  pct: number
}

// Same AFT+MRC-only deployability rule the Readiness Matrix uses (CAC/GTCC/NCOER
// are tracked there too, but don't affect whether a soldier counts as deployable) --
// kept here as the one shared source of truth so this summary and the matrix's
// DEPLOYABLE % can never quietly drift apart.
export function computeReadinessSummary(soldiers: Soldier[], aftTests: AftTest[]): ReadinessSummary {
  const latestAftBySoldier = new Map<string, string>()
  for (const test of aftTests) {
    if (!latestAftBySoldier.has(test.soldier_id)) latestAftBySoldier.set(test.soldier_id, test.test_date)
  }

  let goCount = 0
  let atRiskCount = 0
  let noGoCount = 0
  for (const s of soldiers) {
    if (s.status !== 'active') continue
    const aTone = aftTone(latestAftBySoldier.get(s.id) ?? null)
    const mTone = mrcTone(s.mrc_status)
    const tone: Tone = aTone === 'bad' || mTone === 'bad' ? 'bad' : aTone === 'warn' || mTone === 'warn' ? 'warn' : 'good'
    if (tone === 'good') goCount++
    else if (tone === 'warn') atRiskCount++
    else noGoCount++
  }

  const total = goCount + atRiskCount + noGoCount
  return { total, goCount, atRiskCount, noGoCount, pct: total > 0 ? Math.round((goCount / total) * 100) : 0 }
}
