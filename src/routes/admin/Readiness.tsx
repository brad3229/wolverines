import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { listAftTests } from '../../lib/aft'
import { AFT_WARNING_DAYS, aftDueDate } from '../../lib/aft'
import { flagForDate, ncoerDueDate, CAC_WARNING_DAYS, NCOER_WARNING_DAYS, type ExpirationFlag } from '../../lib/expirations'
import { SQUADS } from '../../components/SoldierForm'
import { errorMessage } from '../../lib/errors'
import { LoadingScreen } from '../../components/LoadingScreen'
import { SoldierAvatar } from '../../components/SoldierAvatar'
import type { AftTest, Soldier } from '../../types/database'

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-good-bg text-good-ink',
  warn: 'bg-warn-bg text-warn-ink',
  bad: 'bg-bad-bg text-bad-ink',
  neutral: 'bg-neutral-bg text-neutral-ink',
}

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  )
}

function toneForFlag(flag: ExpirationFlag): Tone {
  return flag === 'expired' ? 'bad' : flag === 'soon' ? 'warn' : 'good'
}

function labelForFlag(flag: ExpirationFlag, overdueWord: string) {
  return flag === 'expired' ? overdueWord : flag === 'soon' ? 'SOON' : 'OK'
}

interface ReadinessRow {
  soldier: Soldier
  aft: { tone: Tone; label: string }
  mrc: { tone: Tone; label: string }
  cac: { tone: Tone; label: string }
  gtcc: { tone: Tone; label: string }
  ncoer: { tone: Tone; label: string }
}

function buildRow(soldier: Soldier, latestAftDate: string | null): ReadinessRow {
  const aft = (() => {
    if (!latestAftDate) return { tone: 'neutral' as Tone, label: 'NO TEST' }
    const flag = flagForDate(aftDueDate(latestAftDate), AFT_WARNING_DAYS)
    return { tone: toneForFlag(flag), label: labelForFlag(flag, 'OVERDUE') }
  })()

  const mrc = (() => {
    if (!soldier.mrc_status) return { tone: 'neutral' as Tone, label: '—' }
    if (soldier.mrc_status === '4') return { tone: 'bad' as Tone, label: '4' }
    if (soldier.mrc_status === '3') return { tone: 'warn' as Tone, label: '3' }
    return { tone: 'good' as Tone, label: soldier.mrc_status }
  })()

  const cac = (() => {
    const flag = flagForDate(soldier.cac_expiration_date, CAC_WARNING_DAYS)
    return { tone: toneForFlag(flag), label: labelForFlag(flag, 'EXPIRED') }
  })()

  const gtcc = soldier.has_gtcc ? { tone: 'good' as Tone, label: 'YES' } : { tone: 'bad' as Tone, label: 'NO' }

  const ncoer = (() => {
    if (!soldier.is_nco) return { tone: 'neutral' as Tone, label: 'N/A' }
    if (!soldier.last_ncoer_date) return { tone: 'neutral' as Tone, label: 'NO DATA' }
    const flag = flagForDate(ncoerDueDate(soldier.last_ncoer_date), NCOER_WARNING_DAYS)
    return { tone: toneForFlag(flag), label: labelForFlag(flag, 'OVERDUE') }
  })()

  return { soldier, aft, mrc, cac, gtcc, ncoer }
}

export function Readiness() {
  const navigate = useNavigate()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [aftTests, setAftTests] = useState<AftTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  useEffect(() => {
    Promise.all([listSoldiers(), listAftTests()])
      .then(([soldierData, aftData]) => {
        setSoldiers(soldierData.filter((s) => s.status === 'active'))
        setAftTests(aftData)
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load readiness data')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />

  // aftTests is already ordered test_date desc, so the first match per soldier is their latest.
  const latestAftBySoldier = new Map<string, string>()
  for (const test of aftTests) {
    if (!latestAftBySoldier.has(test.soldier_id)) latestAftBySoldier.set(test.soldier_id, test.test_date)
  }

  const rows = soldiers.map((s) => buildRow(s, latestAftBySoldier.get(s.id) ?? null))
  const isFlagged = (r: ReadinessRow) => [r.aft, r.mrc, r.cac, r.gtcc, r.ncoer].some((c) => c.tone === 'bad' || c.tone === 'warn')
  const visibleRows = flaggedOnly ? rows.filter(isFlagged) : rows
  const flaggedCount = rows.filter(isFlagged).length

  const squadGroups = [...SQUADS, null]
    .map((squad) => ({ squad, rows: visibleRows.filter((r) => r.soldier.squad === squad) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <p className="text-sm font-semibold text-ink-dim">
          {flaggedCount} of {rows.length} soldiers flagged
        </p>
        <label className="flex items-center gap-2 text-sm text-ink-dim">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Flagged only
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      {visibleRows.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-ink-muted">
          {flaggedOnly ? 'No one is flagged right now.' : 'No active soldiers.'}
        </p>
      ) : (
        <>
          {/* Card list — mobile */}
          <div className="space-y-4 sm:hidden">
            {squadGroups.map((group) => (
              <div key={group.squad ?? 'unassigned'}>
                <h2 className="mb-2 font-display text-[15px] font-semibold tracking-wide text-ink-muted">
                  {group.squad ?? 'UNASSIGNED'} ({group.rows.length})
                </h2>
                <div className="space-y-2">
                  {group.rows.map((r) => (
                    <Link
                      key={r.soldier.id}
                      to={`/admin/roster/${r.soldier.id}`}
                      className="block rounded-xl border border-line bg-panel p-4"
                    >
                      <div className="mb-3 flex items-center gap-2.5 font-semibold">
                        <SoldierAvatar soldier={r.soldier} />
                        <span className="truncate">
                          {r.soldier.rank} {r.soldier.last_name}, {r.soldier.first_name}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        {(['AFT', 'MRC', 'CAC', 'GTCC', 'NCOER'] as const).map((label) => {
                          const cell = { AFT: r.aft, MRC: r.mrc, CAC: r.cac, GTCC: r.gtcc, NCOER: r.ncoer }[label]
                          return (
                            <div key={label}>
                              <div className="mb-1 text-[9px] tracking-wide text-ink-faint">{label}</div>
                              <StatusPill tone={cell.tone} label={cell.label} />
                            </div>
                          )
                        })}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Table — sm and up */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-panel sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">NAME</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">AFT</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">MRC</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">CAC</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">GTCC</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">NCOER</th>
                </tr>
              </thead>
              <tbody>
                {squadGroups.map((group) => (
                  <Fragment key={group.squad ?? 'unassigned'}>
                    <tr className="border-t border-line bg-surface">
                      <td colSpan={6} className="px-4 py-2 text-[13px] font-semibold tracking-wide text-ink-muted">
                        {group.squad ?? 'UNASSIGNED'} ({group.rows.length})
                      </td>
                    </tr>
                    {group.rows.map((r) => (
                      <tr
                        key={r.soldier.id}
                        onClick={() => navigate(`/admin/roster/${r.soldier.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/admin/roster/${r.soldier.id}`)
                        }}
                        tabIndex={0}
                        className="cursor-pointer border-t border-line hover:bg-surface-raised focus:outline-none"
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <SoldierAvatar soldier={r.soldier} className="h-7 w-7" />
                            {r.soldier.last_name}, {r.soldier.first_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.aft.tone} label={r.aft.label} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.mrc.tone} label={r.mrc.label} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.cac.tone} label={r.cac.label} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.gtcc.tone} label={r.gtcc.label} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.ncoer.tone} label={r.ncoer.label} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
