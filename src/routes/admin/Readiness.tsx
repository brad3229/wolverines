import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { listAftTests } from '../../lib/aft'
import { AFT_WARNING_DAYS, aftDueDate } from '../../lib/aft'
import { flagForDate, ncoerDueDate, CAC_WARNING_DAYS, NCOER_WARNING_DAYS, type ExpirationFlag } from '../../lib/expirations'
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
function StatusBlock({ tone, label, numeric }: { tone: Tone; label: string; numeric?: boolean }) {
  const glyph = numeric ? label : tone === 'warn' ? '!' : tone === 'bad' ? '×' : tone === 'neutral' ? '–' : ''
  return (
    <div className={`flex h-9 items-center justify-center rounded-lg text-sm font-extrabold ${TONE_CLASS[tone]}`}>
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
  // Longer human-readable context for the detail panel -- the table/card pills
  // only have room for a short code (OK/SOON/OVERDUE), not the date behind it.
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
    if (!latestAftDate) return { tone: 'neutral', label: 'NO TEST', detail: 'No AFT test on record.' }
    const flag = flagForDate(aftDueDate(latestAftDate), AFT_WARNING_DAYS)
    return {
      tone: toneForFlag(flag),
      label: labelForFlag(flag, 'OVERDUE'),
      detail: `Last test ${formatDate(latestAftDate)} · next due ${formatDate(aftDueDate(latestAftDate))}.`,
    }
  })()

  const mrc: StatusCell = (() => {
    if (!soldier.mrc_status) return { tone: 'neutral', label: '—', detail: 'No MRC status on record.' }
    const tone = soldier.mrc_status === '4' ? 'bad' : soldier.mrc_status === '3' ? 'warn' : 'good'
    return { tone, label: soldier.mrc_status, detail: `Medical Readiness Classification ${soldier.mrc_status}.` }
  })()

  const cac: StatusCell = (() => {
    const flag = flagForDate(soldier.cac_expiration_date, CAC_WARNING_DAYS)
    return {
      tone: toneForFlag(flag),
      label: labelForFlag(flag, 'EXPIRED'),
      detail: soldier.cac_expiration_date ? `Expires ${formatDate(soldier.cac_expiration_date)}.` : 'No expiration date on file.',
    }
  })()

  const gtcc: StatusCell = soldier.has_gtcc
    ? { tone: 'good', label: 'YES', detail: 'Has a GTCC on file.' }
    : { tone: 'bad', label: 'NO', detail: 'No GTCC on file.' }

  const ncoer: StatusCell = (() => {
    if (!soldier.is_nco) return { tone: 'neutral', label: 'N/A', detail: 'Not applicable below NCO.' }
    if (!soldier.last_ncoer_date) return { tone: 'neutral', label: 'NO DATA', detail: 'No NCOER on file.' }
    const flag = flagForDate(ncoerDueDate(soldier.last_ncoer_date), NCOER_WARNING_DAYS)
    return {
      tone: toneForFlag(flag),
      label: labelForFlag(flag, 'OVERDUE'),
      detail: `Last NCOER ${formatDate(soldier.last_ncoer_date)} · next due ${formatDate(ncoerDueDate(soldier.last_ncoer_date))}.`,
    }
  })()

  return { soldier, aft, mrc, cac, gtcc, ncoer }
}

function DetailPanel({ row }: { row: ReadinessRow | null }) {
  if (!row) {
    return (
      <div className="hidden w-72 flex-shrink-0 rounded-xl border border-line bg-panel p-5 sm:block">
        <p className="text-sm text-ink-muted">Select a soldier to see their full readiness detail here.</p>
      </div>
    )
  }
  const { soldier } = row
  const categories: { label: string; cell: StatusCell }[] = [
    { label: 'AFT', cell: row.aft },
    { label: 'MRC', cell: row.mrc },
    { label: 'CAC', cell: row.cac },
    { label: 'GTCC', cell: row.gtcc },
    { label: 'NCOER', cell: row.ncoer },
  ]
  return (
    <div className="hidden w-72 flex-shrink-0 sm:block">
      <div className="sticky top-0 rounded-xl border border-line bg-panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <SoldierAvatar soldier={soldier} className="h-11 w-11" />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-semibold">
              {soldier.rank} {soldier.last_name}, {soldier.first_name}
            </div>
            <div className="text-xs text-ink-muted">{soldier.squad ?? 'Unassigned'}</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {categories.map(({ label, cell }) => (
            <div
              key={label}
              className="flex items-start justify-between gap-2 border-t border-line-soft pt-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-wide text-ink-faint">{label}</div>
                <div className="text-xs text-ink-muted">{cell.detail}</div>
              </div>
              <StatusPill tone={cell.tone} label={cell.label} />
            </div>
          ))}
        </div>
        <Link
          to={`/admin/roster/${soldier.id}`}
          className="mt-4 block rounded-md bg-accent-soft px-3 py-2 text-center text-xs font-bold tracking-wide text-accent-soft-ink"
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
  const selectedRow = rows.find((r) => r.soldier.id === selectedId) ?? null

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
                        <tr
                          key={r.soldier.id}
                          onClick={() => setSelectedId(r.soldier.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setSelectedId(r.soldier.id)
                          }}
                          tabIndex={0}
                          className={`cursor-pointer border-t border-line focus:outline-none ${
                            selectedId === r.soldier.id ? 'bg-surface-raised' : 'hover:bg-surface-raised'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              <SoldierAvatar soldier={r.soldier} className="h-7 w-7" />
                              {r.soldier.last_name}, {r.soldier.first_name}
                            </div>
                          </td>
                          <td className="p-1.5">
                            <StatusBlock tone={r.aft.tone} label={r.aft.label} />
                          </td>
                          <td className="p-1.5">
                            <StatusBlock tone={r.mrc.tone} label={r.mrc.label} numeric />
                          </td>
                          <td className="p-1.5">
                            <StatusBlock tone={r.cac.tone} label={r.cac.label} />
                          </td>
                          <td className="p-1.5">
                            <StatusBlock tone={r.gtcc.tone} label={r.gtcc.label} />
                          </td>
                          <td className="p-1.5">
                            <StatusBlock tone={r.ncoer.tone} label={r.ncoer.label} />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <DetailPanel row={selectedRow} />
          </div>
        </>
      )}
    </div>
  )
}
