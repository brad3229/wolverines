import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { listAftTests } from '../../lib/aft'
import { AFT_WARNING_DAYS, aftDueDate } from '../../lib/aft'
import {
  flagForDate,
  daysUntil,
  ncoerDueDate,
  CAC_WARNING_DAYS,
  NCOER_WARNING_DAYS,
  type ExpirationFlag,
} from '../../lib/expirations'
import { formatDate } from '../../lib/dates'
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

// The matrix cells themselves -- a solid color block per soldier/category, the
// tone doing the talking rather than a text badge. Good is left blank on
// purpose (nothing to flag); warn/bad/neutral get a one-character glyph.
// MRC is the exception -- its number (1-4) is itself the informative part,
// so it always shows even on a "good" 1 or 2.
function StatusBlock({
  tone,
  label,
  numeric,
  onClick,
  selected,
}: {
  tone: Tone
  label: string
  numeric?: boolean
  onClick?: () => void
  selected?: boolean
}) {
  const glyph = numeric ? label : tone === 'warn' ? '!' : tone === 'bad' ? '×' : tone === 'neutral' ? '–' : ''
  return (
    <div
      onClick={onClick}
      className={`flex h-9 items-center justify-center rounded-lg text-sm font-extrabold ${TONE_CLASS[tone]} ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'outline outline-2 outline-offset-1 outline-ink' : ''}`}
    >
      {glyph}
    </div>
  )
}

function toneForFlag(flag: ExpirationFlag): Tone {
  return flag === 'expired' ? 'bad' : flag === 'soon' ? 'warn' : 'good'
}

function labelForFlag(flag: ExpirationFlag, overdueWord: string) {
  return flag === 'expired' ? overdueWord : flag === 'soon' ? 'SOON' : 'OK'
}

interface StatusCell {
  tone: Tone
  label: string
  // The word shown as a pill in the detail panel -- distinct from `label`,
  // which is the short matrix-cell code/glyph trigger (OK/SOON/1-4/etc).
  pillLabel: string
  // Full sentence for the detail panel, day counts and all.
  detail: string
}

interface ReadinessRow {
  soldier: Soldier
  aft: StatusCell
  mrc: StatusCell
  cac: StatusCell
  gtcc: StatusCell
  ncoer: StatusCell
}

function buildRow(soldier: Soldier, latestAftDate: string | null): ReadinessRow {
  const aft: StatusCell = (() => {
    if (!latestAftDate) return { tone: 'neutral', label: 'NO TEST', pillLabel: 'NO DATA', detail: 'No AFT test on record.' }
    const due = aftDueDate(latestAftDate)
    const flag = flagForDate(due, AFT_WARNING_DAYS)
    const days = daysUntil(due)
    const detail =
      flag === 'expired'
        ? `AFT overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}.`
        : flag === 'soon'
          ? `AFT due in ${days} day${days === 1 ? '' : 's'}.`
          : `Last test ${formatDate(latestAftDate)} · next due ${formatDate(due)}.`
    return {
      tone: toneForFlag(flag),
      label: labelForFlag(flag, 'OVERDUE'),
      pillLabel: flag === 'expired' ? 'OVERDUE' : flag === 'soon' ? 'DUE SOON' : 'CURRENT',
      detail,
    }
  })()

  const mrc: StatusCell = (() => {
    if (!soldier.mrc_status) return { tone: 'neutral', label: '—', pillLabel: 'NOT RECORDED', detail: 'No MRC status on record.' }
    const tone: Tone = soldier.mrc_status === '4' ? 'bad' : soldier.mrc_status === '3' ? 'warn' : 'good'
    return {
      tone,
      label: soldier.mrc_status,
      pillLabel: tone === 'good' ? 'READY' : 'FLAGGED',
      detail: `Medical Readiness Classification ${soldier.mrc_status}.`,
    }
  })()

  const cac: StatusCell = (() => {
    const flag = flagForDate(soldier.cac_expiration_date, CAC_WARNING_DAYS)
    const days = soldier.cac_expiration_date ? daysUntil(soldier.cac_expiration_date) : null
    const detail = !soldier.cac_expiration_date
      ? 'No expiration date on file.'
      : flag === 'expired'
        ? `CAC expired ${Math.abs(days!)} day${Math.abs(days!) === 1 ? '' : 's'} ago.`
        : flag === 'soon'
          ? `CAC expires in ${days} day${days === 1 ? '' : 's'}.`
          : `Expires ${formatDate(soldier.cac_expiration_date)}.`
    return {
      tone: toneForFlag(flag),
      label: labelForFlag(flag, 'EXPIRED'),
      pillLabel: flag === 'expired' ? 'EXPIRED' : flag === 'soon' ? 'EXPIRING SOON' : soldier.cac_expiration_date ? 'CURRENT' : 'NO DATA',
      detail,
    }
  })()

  const gtcc: StatusCell = soldier.has_gtcc
    ? { tone: 'good', label: 'YES', pillLabel: 'ON FILE', detail: 'Has a GTCC on file.' }
    : { tone: 'bad', label: 'NO', pillLabel: 'MISSING', detail: 'No GTCC on file.' }

  const ncoer: StatusCell = (() => {
    if (!soldier.is_nco) return { tone: 'neutral', label: 'N/A', pillLabel: 'N/A', detail: 'Not applicable below NCO.' }
    if (!soldier.last_ncoer_date) return { tone: 'neutral', label: 'NO DATA', pillLabel: 'NO DATA', detail: 'No NCOER on file.' }
    const due = ncoerDueDate(soldier.last_ncoer_date)
    const flag = flagForDate(due, NCOER_WARNING_DAYS)
    const days = daysUntil(due)
    const detail =
      flag === 'expired'
        ? `NCOER overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}.`
        : flag === 'soon'
          ? `NCOER due in ${days} day${days === 1 ? '' : 's'}.`
          : `Last NCOER ${formatDate(soldier.last_ncoer_date)} · next due ${formatDate(due)}.`
    return {
      tone: toneForFlag(flag),
      label: labelForFlag(flag, 'OVERDUE'),
      pillLabel: flag === 'expired' ? 'LAPSED' : flag === 'soon' ? 'DUE SOON' : 'CURRENT',
      detail,
    }
  })()

  return { soldier, aft, mrc, cac, gtcc, ncoer }
}

type CategoryKey = 'aft' | 'mrc' | 'cac' | 'gtcc' | 'ncoer'

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  aft: 'AFT',
  mrc: 'MRC',
  cac: 'CAC',
  gtcc: 'GTCC',
  ncoer: 'NCOER',
}

// Same AFT+MRC-only rule as isFlagged below, just split into three tiers
// (good/warn/bad) instead of a flagged/not-flagged boolean.
function deployStatus(r: ReadinessRow): Tone {
  if (r.aft.tone === 'bad' || r.mrc.tone === 'bad') return 'bad'
  if (r.aft.tone === 'warn' || r.mrc.tone === 'warn') return 'warn'
  return 'good'
}

function DeployabilitySummary({ rows }: { rows: ReadinessRow[] }) {
  const total = rows.length
  const goCount = rows.filter((r) => deployStatus(r) === 'good').length
  const atRiskCount = rows.filter((r) => deployStatus(r) === 'warn').length
  const noGoCount = rows.filter((r) => deployStatus(r) === 'bad').length
  const pct = total > 0 ? Math.round((goCount / total) * 100) : 0

  return (
    <div className="mb-4 rounded-xl border border-line bg-panel p-4 sm:mb-5 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-shrink-0">
          <div className="text-[11px] font-semibold tracking-wide text-ink-faint">DEPLOYABLE</div>
          <div className="font-display text-4xl font-bold text-accent">{pct}%</div>
          <div className="text-xs text-ink-muted">
            {goCount} of {total} soldier{total === 1 ? '' : 's'} GO
          </div>
        </div>
        {total > 0 && (
          <div className="flex h-8 flex-1 overflow-hidden rounded-lg text-[11px] font-bold tracking-wide">
            {goCount > 0 && (
              <div
                className="flex items-center justify-center bg-good-bg text-good-ink"
                style={{ flexGrow: goCount }}
              >
                GO {goCount}
              </div>
            )}
            {atRiskCount > 0 && (
              <div
                className="flex items-center justify-center bg-warn-bg text-warn-ink"
                style={{ flexGrow: atRiskCount }}
              >
                AT RISK {atRiskCount}
              </div>
            )}
            {noGoCount > 0 && (
              <div
                className="flex items-center justify-center bg-bad-bg text-bad-ink"
                style={{ flexGrow: noGoCount }}
              >
                NO-GO {noGoCount}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailPanel({ row, category }: { row: ReadinessRow; category: CategoryKey }) {
  const { soldier } = row
  const cell = row[category]
  return (
    <div className="hidden w-72 flex-shrink-0 sm:block">
      <div className="sticky top-0 rounded-xl border border-line bg-panel p-5">
        <div className="mb-3 text-[11px] font-semibold tracking-wide text-ink-faint">{CATEGORY_LABEL[category]}</div>
        <div className="mb-3 flex items-center gap-3">
          <SoldierAvatar soldier={soldier} className="h-11 w-11" />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-semibold">
              {soldier.rank} {soldier.last_name}, {soldier.first_name}
            </div>
            <div className="text-xs text-ink-muted">{soldier.squad ?? 'Unassigned'}</div>
          </div>
        </div>
        <div className="mb-3">
          <StatusPill tone={cell.tone} label={cell.pillLabel} />
        </div>
        <p className="mb-4 text-sm text-ink-dim">{cell.detail}</p>
        <Link
          to={`/admin/roster/${soldier.id}`}
          className="block rounded-md bg-accent-soft px-3 py-2 text-center text-xs font-bold tracking-wide text-accent-soft-ink"
        >
          VIEW FULL PROFILE &rarr;
        </Link>
      </div>
    </div>
  )
}

export function Readiness() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [aftTests, setAftTests] = useState<AftTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ soldierId: string; category: CategoryKey } | null>(null)

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
  // Deployability only turns on AFT and MRC -- CAC/GTCC/NCOER are tracked here too
  // (still shown, still colored) but don't affect whether a soldier counts as flagged.
  const isFlagged = (r: ReadinessRow) => deployStatus(r) !== 'good'
  const visibleRows = flaggedOnly ? rows.filter(isFlagged) : rows
  const selectedRow = rows.find((r) => r.soldier.id === selectedCell?.soldierId) ?? null

  const squadGroups = [...SQUADS, null]
    .map((squad) => ({ squad, rows: visibleRows.filter((r) => r.soldier.squad === squad) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div>
      <DeployabilitySummary rows={rows} />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-3 sm:mb-5">
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
                              <StatusBlock tone={cell.tone} label={cell.label} numeric={label === 'MRC'} />
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

          {/* Table — sm and up, with a detail panel alongside instead of navigating away */}
          <div className="hidden gap-4 sm:flex">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-panel">
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
                        <tr key={r.soldier.id} className="border-t border-line">
                          <td className="px-4 py-3 font-medium">
                            <Link to={`/admin/roster/${r.soldier.id}`} className="flex items-center gap-2 hover:underline">
                              <SoldierAvatar soldier={r.soldier} className="h-7 w-7" />
                              {r.soldier.last_name}, {r.soldier.first_name}
                            </Link>
                          </td>
                          {(['aft', 'mrc', 'cac', 'gtcc', 'ncoer'] as const).map((category) => (
                            <td key={category} className="p-1.5">
                              <StatusBlock
                                tone={r[category].tone}
                                label={r[category].label}
                                numeric={category === 'mrc'}
                                onClick={() => setSelectedCell({ soldierId: r.soldier.id, category })}
                                selected={selectedCell?.soldierId === r.soldier.id && selectedCell?.category === category}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedRow && selectedCell && <DetailPanel row={selectedRow} category={selectedCell.category} />}
          </div>
        </>
      )}
    </div>
  )
}
