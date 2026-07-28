import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSoldiers, createSoldier } from '../../lib/soldiers'
import { SoldierForm, soldierFormValuesToPayload } from '../../components/SoldierForm'
import { flagForDate, ETS_WARNING_DAYS, CAC_WARNING_DAYS } from '../../lib/expirations'
import { errorMessage } from '../../lib/errors'
import { LoadingScreen } from '../../components/LoadingScreen'
import { IconPhone } from '../../components/icons'
import type { Soldier } from '../../types/database'

function etsClass(s: Soldier) {
  const flag = flagForDate(s.ets_date, ETS_WARNING_DAYS)
  return flag === 'expired' ? 'font-semibold text-bad-ink' : flag === 'soon' ? 'font-semibold text-warn-ink' : ''
}

export function Roster() {
  const navigate = useNavigate()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    setLoadError(null)
    listSoldiers()
      .then(setSoldiers)
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load roster')))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const filtered = soldiers
    .filter((s) => s.status === (showInactive ? 'inactive' : 'active'))
    .filter((s) => `${s.rank} ${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Roster</h1>
          <p className="mt-1 text-[13px] text-ink-muted">{filtered.length} soldiers assigned</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showAddForm ? 'CANCEL' : '+ ADD SOLDIER'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <SoldierForm
            submitLabel="Add Soldier"
            onSubmit={async (values) => {
              await createSoldier(soldierFormValuesToPayload(values))
              setShowAddForm(false)
              refresh()
            }}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          placeholder="Search by name or rank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-line bg-panel px-3 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-ink-dim">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Show inactive only
        </label>
      </div>

      {loadError && <p className="mb-4 text-sm text-bad-ink">{loadError}</p>}

      {loading ? (
        <LoadingScreen />
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-ink-muted">No Soldiers found.</p>
      ) : (
        <>
          {/* Card list — mobile */}
          <div className="space-y-2 sm:hidden">
            {filtered.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-panel p-4">
                <Link to={`/admin/roster/${s.id}`} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {s.rank} {s.last_name}, {s.first_name}
                    </p>
                    <div className="flex flex-shrink-0 gap-1.5">
                      {flagForDate(s.cac_expiration_date, CAC_WARNING_DAYS) && (
                        <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                          CAC
                        </span>
                      )}
                      {!s.receives_drill_pay && (
                        <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                          NO PAY
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`mt-1 text-sm ${etsClass(s) || 'text-ink-muted'}`}>
                    ETS {s.ets_date} &middot; {s.status}
                  </p>
                </Link>
                {s.phone_number && (
                  <a
                    href={`tel:${s.phone_number.replace(/[^\d+]/g, '')}`}
                    className="mt-2.5 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-base font-bold text-accent-soft-ink"
                  >
                    <IconPhone className="h-5 w-5" />
                    {s.phone_number}
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Table — sm and up */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-panel sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">NAME</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">RANK</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">ETS DATE</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">PAY</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">PHONE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/roster/${s.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/admin/roster/${s.id}`)
                    }}
                    tabIndex={0}
                    className="cursor-pointer border-t border-line hover:bg-surface-raised focus:outline-none"
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-1.5">
                        {s.last_name}, {s.first_name}
                        {flagForDate(s.cac_expiration_date, CAC_WARNING_DAYS) && (
                          <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warn-ink">
                            CAC
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-dim">{s.rank}</td>
                    <td className={`px-4 py-3 ${etsClass(s) || 'text-ink-dim'}`}>{s.ets_date}</td>
                    <td className={`px-4 py-3 ${s.receives_drill_pay ? 'text-ink-dim' : 'font-semibold text-warn-ink'}`}>
                      {s.receives_drill_pay ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 text-ink-dim">
                      {s.phone_number ? (
                        <a
                          href={`tel:${s.phone_number.replace(/[^\d+]/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 font-semibold text-accent-soft-ink hover:underline"
                        >
                          <IconPhone className="h-3.5 w-3.5" />
                          {s.phone_number}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
