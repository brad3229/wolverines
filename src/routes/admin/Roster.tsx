import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { listSoldiers, createSoldier, updateSoldier } from '../../lib/soldiers'
import { SoldierForm, soldierFormValuesToPayload, SQUADS } from '../../components/SoldierForm'
import { flagForDate, ncoerDueDate, ETS_WARNING_DAYS, CAC_WARNING_DAYS, NCOER_WARNING_DAYS } from '../../lib/expirations'
import { formatDate } from '../../lib/dates'
import { formatPhoneNumber } from '../../lib/phone'
import { errorMessage } from '../../lib/errors'
import { LoadingScreen } from '../../components/LoadingScreen'
import { SoldierAvatar } from '../../components/SoldierAvatar'
import { IconPhone, IconCheck, IconGripVertical } from '../../components/icons'
import type { Soldier } from '../../types/database'

function etsClass(s: Soldier) {
  const flag = flagForDate(s.ets_date, ETS_WARNING_DAYS)
  return flag === 'expired' ? 'font-semibold text-bad-ink' : flag === 'soon' ? 'font-semibold text-warn-ink' : ''
}

function ncoerFlag(s: Soldier) {
  if (!s.is_nco || !s.last_ncoer_date) return null
  return flagForDate(ncoerDueDate(s.last_ncoer_date), NCOER_WARNING_DAYS)
}

function mrcFlagged(s: Soldier) {
  return s.mrc_status === '3' || s.mrc_status === '4'
}

// A squad's drop target isn't just its header -- every row belonging to that
// squad is droppable too (see DesktopSoldierRow/MobileSoldierCard), so you can
// drop a soldier anywhere in that squad's block, not just on the thin label.
function useSquadDroppable(squad: Soldier['squad'], key: string) {
  return useDroppable({ id: `squad-${squad ?? 'unassigned'}-${key}`, data: { squad } })
}

function DroppableSquadSection({ squad, children }: { squad: Soldier['squad']; children: ReactNode }) {
  const { setNodeRef, isOver } = useSquadDroppable(squad, 'section')
  return (
    <div ref={setNodeRef} className={`rounded-xl ${isOver ? 'bg-accent-soft/20' : ''}`}>
      {children}
    </div>
  )
}

function DroppableSquadHeaderRow({ squad, children }: { squad: Soldier['squad']; children: ReactNode }) {
  const { setNodeRef, isOver } = useSquadDroppable(squad, 'header')
  return (
    <tr ref={setNodeRef} className={`border-t border-line ${isOver ? 'bg-accent-soft' : 'bg-surface'}`}>
      {children}
    </tr>
  )
}

function MobileSoldierCard({ soldier: s }: { soldier: Soldier }) {
  // The grip is its own drag source, separate from the Link/tel: anchors below --
  // dnd-kit's sensors won't start a drag from inside an <a>, so making the whole
  // card draggable would silently break and just navigate instead.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: s.id })
  return (
    <div ref={setNodeRef} className={`rounded-xl border border-line bg-panel p-4 ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-2">
        <Link to={`/admin/roster/${s.id}`} className="block min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5 font-semibold">
              <div className="relative flex-shrink-0">
                <SoldierAvatar soldier={s} />
                {s.profile_id && (
                  <span
                    title="Account linked"
                    className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-good-ink ring-2 ring-panel"
                  >
                    <IconCheck className="h-2 w-2 text-panel" />
                  </span>
                )}
              </div>
              <span className="truncate">
                {s.rank} {s.last_name}, {s.first_name}
              </span>
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
              {flagForDate(s.cac_expiration_date, CAC_WARNING_DAYS) && (
                <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                  CAC
                </span>
              )}
              {ncoerFlag(s) && (
                <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                  NCOER
                </span>
              )}
              {mrcFlagged(s) && (
                <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                  MRC {s.mrc_status}
                </span>
              )}
              {!s.receives_drill_pay && (
                <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn-ink">
                  DO NOT PAY
                </span>
              )}
            </div>
          </div>
          <p className={`mt-1 text-sm ${etsClass(s) || 'text-ink-muted'}`}>
            ETS {formatDate(s.ets_date)} &middot; {s.status}
          </p>
        </Link>
        <div
          {...listeners}
          {...attributes}
          title="Drag to reassign squad"
          className={`flex-shrink-0 rounded-md p-1.5 text-ink-faint ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <IconGripVertical />
        </div>
      </div>
      {s.phone_number && (
        <a
          href={`tel:${s.phone_number.replace(/[^\d+]/g, '')}`}
          className="mt-2.5 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-base font-bold text-accent-soft-ink"
        >
          <IconPhone className="h-5 w-5" />
          {formatPhoneNumber(s.phone_number)}
        </a>
      )}
    </div>
  )
}

function DesktopSoldierRow({ soldier: s, onOpen }: { soldier: Soldier; onOpen: () => void }) {
  // Same reasoning as MobileSoldierCard -- the grip is its own drag source
  // rather than the whole row, so it doesn't fight with the tel: link cell.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: s.id })
  // Every row is also a drop target for its own squad, not just the header --
  // dragging a soldier onto any other soldier in 2nd Squad still means "move to 2nd Squad."
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `row-${s.id}`, data: { squad: s.squad } })
  return (
    <tr
      ref={(node) => {
        setDragRef(node)
        setDropRef(node)
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      tabIndex={0}
      className={`cursor-pointer border-t border-line focus:outline-none ${
        isDragging ? 'opacity-40' : isOver ? 'bg-accent-soft' : 'hover:bg-surface-raised'
      }`}
    >
      <td className="w-8 px-2 py-3">
        <div
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reassign squad"
          className={`inline-flex rounded-md p-1 text-ink-faint ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <IconGripVertical className="h-4 w-4" />
        </div>
      </td>
      <td className="px-4 py-3 font-medium">
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <SoldierAvatar soldier={s} className="h-7 w-7" />
            {s.profile_id && (
              <span
                title="Account linked"
                className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-good-ink ring-2 ring-panel"
              >
                <IconCheck className="h-1.5 w-1.5 text-panel" />
              </span>
            )}
          </div>
          {s.last_name}, {s.first_name}
          {flagForDate(s.cac_expiration_date, CAC_WARNING_DAYS) && (
            <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warn-ink">
              CAC
            </span>
          )}
          {ncoerFlag(s) && (
            <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warn-ink">
              NCOER
            </span>
          )}
          {mrcFlagged(s) && (
            <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warn-ink">
              MRC {s.mrc_status}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-ink-dim">{s.rank}</td>
      <td className={`px-4 py-3 ${etsClass(s) || 'text-ink-dim'}`}>{formatDate(s.ets_date)}</td>
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
            {formatPhoneNumber(s.phone_number)}
          </a>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}

export function Roster() {
  const navigate = useNavigate()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeSoldier, setActiveSoldier] = useState<Soldier | null>(null)
  const [overSquad, setOverSquad] = useState<Soldier['squad'] | undefined>(undefined)

  // Distance/delay thresholds below are what let a plain tap or click still fall
  // through to navigation and tap-to-call -- a drag only "activates" past them.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  function refresh() {
    setLoading(true)
    setLoadError(null)
    listSoldiers()
      .then(setSoldiers)
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load roster')))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  function handleDragStart(event: DragStartEvent) {
    setActiveSoldier(soldiers.find((s) => s.id === event.active.id) ?? null)
    setOverSquad(undefined)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverSquad(event.over?.data.current?.squad as Soldier['squad'] | undefined)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveSoldier(null)
    setOverSquad(undefined)
    const { active, over } = event
    if (!over) return
    const targetSquad = over.data.current?.squad as Soldier['squad'] | undefined
    if (targetSquad === undefined) return
    const soldierId = active.id as string
    const soldier = soldiers.find((s) => s.id === soldierId)
    if (!soldier || soldier.squad === targetSquad) return
    // Optimistic update -- reassigning a squad should feel instant, and the
    // in-flight request rarely fails for a simple column update like this.
    setSoldiers((prev) => prev.map((s) => (s.id === soldierId ? { ...s, squad: targetSquad } : s)))
    try {
      await updateSoldier(soldierId, { squad: targetSquad })
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to move soldier to that squad'))
      refresh()
    }
  }

  const filtered = soldiers
    .filter((s) => s.status === (showInactive ? 'inactive' : 'active'))
    .filter((s) => `${s.rank} ${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))

  // Unassigned soldiers get their own trailing group instead of being hidden.
  const squadGroups = [...SQUADS, null]
    .map((squad) => ({ squad, soldiers: filtered.filter((s) => s.squad === squad) }))
    .filter((g) => g.soldiers.length > 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <p className="text-sm font-semibold text-ink-dim">{filtered.length} soldiers assigned</p>
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
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <p className="mb-3 text-xs text-ink-faint">
            Drag a soldier by the <IconGripVertical className="inline h-3 w-3 align-text-bottom" /> grip onto a squad name to reassign them.
          </p>

          {/* Card list — mobile */}
          <div className="space-y-4 sm:hidden">
            {squadGroups.map((group) => (
              <DroppableSquadSection key={group.squad ?? 'unassigned'} squad={group.squad}>
                <h2 className="mb-2 font-display text-[15px] font-semibold tracking-wide text-ink-muted">
                  {group.squad ?? 'UNASSIGNED'} ({group.soldiers.length})
                </h2>
                <div className="space-y-2">
                  {group.soldiers.map((s) => (
                    <MobileSoldierCard key={s.id} soldier={s} />
                  ))}
                </div>
              </DroppableSquadSection>
            ))}
          </div>

          {/* Table — sm and up */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-panel sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised">
                <tr>
                  <th className="w-8 px-2 py-3" aria-hidden="true"></th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">NAME</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">RANK</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">ETS DATE</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">PAY-OUT</th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-ink-muted">PHONE</th>
                </tr>
              </thead>
              <tbody>
                {squadGroups.map((group) => (
                  <Fragment key={group.squad ?? 'unassigned'}>
                    <DroppableSquadHeaderRow squad={group.squad}>
                      <td colSpan={6} className="px-4 py-2 text-[13px] font-semibold tracking-wide text-ink-muted">
                        {group.squad ?? 'UNASSIGNED'} ({group.soldiers.length})
                      </td>
                    </DroppableSquadHeaderRow>
                    {group.soldiers.map((s) => (
                      <DesktopSoldierRow key={s.id} soldier={s} onOpen={() => navigate(`/admin/roster/${s.id}`)} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <DragOverlay>
            {activeSoldier && (
              <div className="pointer-events-none whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink opacity-0 shadow-lg [animation:logo-pop_0.15s_ease-out_forwards]">
                {overSquad !== undefined
                  ? `Add ${activeSoldier.last_name}, ${activeSoldier.first_name} to ${overSquad ?? 'Unassigned'}`
                  : `${activeSoldier.rank} ${activeSoldier.last_name}, ${activeSoldier.first_name}`}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
