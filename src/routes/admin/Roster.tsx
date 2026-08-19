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
import { SoldierForm, soldierFormValuesToPayload, PLATOONS, SQUADS } from '../../components/SoldierForm'
import { flagForDate, ncoerDueDate, ETS_WARNING_DAYS, CAC_WARNING_DAYS, NCOER_WARNING_DAYS } from '../../lib/expirations'
import { formatDate } from '../../lib/dates'
import { formatPhoneNumber } from '../../lib/phone'
import { errorMessage } from '../../lib/errors'
import { LoadingScreen } from '../../components/LoadingScreen'
import { SoldierAvatar } from '../../components/SoldierAvatar'
import { IconPhone, IconCheck, IconGripVertical, IconBan } from '../../components/icons'
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
// squad is droppable too (see DesktopSoldierRow/MobileSoldierCard). Styling is
// driven by the parent's centrally-tracked overTarget rather than each
// droppable's own isOver, so the *whole* squad block highlights together no
// matter which specific row/header the pointer happens to be over.
//
// Squad names repeat across platoons ("1st Squad" exists under every
// platoon), so a squad drop target always carries its parent platoon too --
// dropping on a squad reassigns both fields in one action. Dropping directly
// on a platoon's own header (squad: null) reassigns platoon and clears squad,
// since a soldier's old squad has no meaning under a different platoon.
function useReassignDroppable(platoon: Soldier['platoon'], squad: Soldier['squad'], key: string) {
  return useDroppable({
    id: `drop-${platoon ?? 'none'}-${squad ?? 'none'}-${key}`,
    data: { platoon, squad },
  })
}

function platoonLabel(platoon: Soldier['platoon']) {
  return platoon ?? 'Unassigned'
}

function squadLabel(squad: Soldier['squad']) {
  return squad ?? 'Unassigned'
}

function DroppablePlatoonSection({
  platoon,
  isTarget,
  label,
  children,
}: {
  platoon: Soldier['platoon']
  isTarget: boolean
  label: ReactNode
  children: ReactNode
}) {
  const { setNodeRef } = useReassignDroppable(platoon, null, 'platoon-section')
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-2 transition-colors ${
        isTarget ? 'border-2 border-dashed border-accent bg-accent-soft/10' : 'border-2 border-transparent'
      }`}
    >
      <h1 className="mb-3 font-display text-base font-bold tracking-wide text-ink">{label}</h1>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function DroppableSquadSection({
  platoon,
  squad,
  isTarget,
  label,
  children,
}: {
  platoon: Soldier['platoon']
  squad: Soldier['squad']
  isTarget: boolean
  label: ReactNode
  children: ReactNode
}) {
  const { setNodeRef } = useReassignDroppable(platoon, squad, 'squad-section')
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-1.5 transition-colors ${
        isTarget ? 'border-2 border-dashed border-accent bg-accent-soft/20' : 'border-2 border-transparent'
      }`}
    >
      <h2 className="mb-2 font-display text-[15px] font-semibold tracking-wide text-ink-muted">{label}</h2>
      {children}
    </div>
  )
}

function DroppablePlatoonHeaderRow({
  platoon,
  isTarget,
  children,
}: {
  platoon: Soldier['platoon']
  isTarget: boolean
  children: ReactNode
}) {
  const { setNodeRef } = useReassignDroppable(platoon, null, 'platoon-header')
  return (
    <tr ref={setNodeRef} className={`border-t-2 border-line ${isTarget ? 'bg-accent-soft' : 'bg-surface-raised'}`}>
      {children}
    </tr>
  )
}

function DroppableSquadHeaderRow({
  platoon,
  squad,
  isTarget,
  children,
}: {
  platoon: Soldier['platoon']
  squad: Soldier['squad']
  isTarget: boolean
  children: ReactNode
}) {
  const { setNodeRef } = useReassignDroppable(platoon, squad, 'squad-header')
  return (
    <tr ref={setNodeRef} className={`border-t border-line ${isTarget ? 'bg-accent-soft' : 'bg-surface'}`}>
      {children}
    </tr>
  )
}

// What a soldier can be dropped onto: a platoon+squad pair (reassign) or this zone (deactivate).
type DropTarget = { platoon: Soldier['platoon']; squad: Soldier['squad'] } | { action: 'inactivate' }

function isReassignTarget(overTarget: DropTarget | undefined, platoon: Soldier['platoon'], squad: Soldier['squad']) {
  return !!overTarget && !('action' in overTarget) && overTarget.platoon === platoon && overTarget.squad === squad
}

// Fixed to the viewport (not the document) and only mounted while a drag is
// actually in progress -- on a long roster, a zone sitting in normal document
// flow near the top would scroll out of reach the moment you scroll down to
// grab a soldier further down the list.
function InactivateDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'inactivate-zone', data: { action: 'inactivate' } })
  return (
    <div
      ref={setNodeRef}
      className={`fixed inset-x-4 bottom-4 z-40 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-bold tracking-wide shadow-lg transition-colors sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2 ${
        isOver ? 'border-bad-ink bg-bad-bg text-bad-ink' : 'border-line bg-panel text-ink-faint'
      }`}
    >
      <IconBan className="h-4 w-4" />
      Drop a soldier here to mark them inactive
    </div>
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

function DesktopSoldierRow({
  soldier: s,
  isTarget,
  onOpen,
}: {
  soldier: Soldier
  isTarget: boolean
  onOpen: () => void
}) {
  // Same reasoning as MobileSoldierCard -- the grip is its own drag source
  // rather than the whole row, so it doesn't fight with the tel: link cell.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: s.id })
  // Every row is also a drop target for its own squad, not just the header --
  // dragging a soldier onto any other soldier in 2nd Squad still means "move to 2nd Squad."
  const { setNodeRef: setDropRef } = useDroppable({ id: `row-${s.id}`, data: { platoon: s.platoon, squad: s.squad } })
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
        isDragging ? 'opacity-40' : isTarget ? 'bg-accent-soft' : 'hover:bg-surface-raised'
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
  const [overTarget, setOverTarget] = useState<DropTarget | undefined>(undefined)

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
    setOverTarget(undefined)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverTarget(event.over?.data.current as DropTarget | undefined)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveSoldier(null)
    setOverTarget(undefined)
    const { active, over } = event
    if (!over) return
    const target = over.data.current as DropTarget | undefined
    if (!target) return
    const soldierId = active.id as string
    const soldier = soldiers.find((s) => s.id === soldierId)
    if (!soldier) return

    if ('action' in target) {
      if (soldier.status === 'inactive') return
      // Optimistic update -- same reasoning as the squad case below.
      setSoldiers((prev) => prev.map((s) => (s.id === soldierId ? { ...s, status: 'inactive' } : s)))
      try {
        await updateSoldier(soldierId, { status: 'inactive' })
      } catch (err) {
        setLoadError(errorMessage(err, 'Failed to mark soldier inactive'))
        refresh()
      }
      return
    }

    if (soldier.platoon === target.platoon && soldier.squad === target.squad) return
    // Optimistic update -- reassigning a squad/platoon should feel instant, and the
    // in-flight request rarely fails for a simple column update like this.
    setSoldiers((prev) =>
      prev.map((s) => (s.id === soldierId ? { ...s, platoon: target.platoon, squad: target.squad } : s)),
    )
    try {
      await updateSoldier(soldierId, { platoon: target.platoon, squad: target.squad })
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to move soldier'))
      refresh()
    }
  }

  const filtered = soldiers
    .filter((s) => s.status === (showInactive ? 'inactive' : 'active'))
    .filter((s) => `${s.rank} ${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))

  // Grouped platoon -> squad, matching how the unit is actually organized.
  // Unassigned platoons/squads get their own trailing group instead of being hidden.
  const platoonGroups = [...PLATOONS, null]
    .map((platoon) => ({
      platoon,
      squadGroups: [...SQUADS, null]
        .map((squad) => ({ squad, soldiers: filtered.filter((s) => s.platoon === platoon && s.squad === squad) }))
        .filter((g) => g.soldiers.length > 0),
    }))
    .filter((g) => g.squadGroups.length > 0)

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
            Drag a soldier by the <IconGripVertical className="inline h-3 w-3 align-text-bottom" /> grip onto a squad or platoon to
            reassign them, or keep dragging to mark them inactive.
          </p>

          {!showInactive && activeSoldier && <InactivateDropZone />}

          {/* Card list — mobile */}
          <div className="space-y-6 sm:hidden">
            {platoonGroups.map((pGroup) => {
              const platoonTargeted = isReassignTarget(overTarget, pGroup.platoon, null)
              return (
                <DroppablePlatoonSection
                  key={pGroup.platoon ?? 'unassigned'}
                  platoon={pGroup.platoon}
                  isTarget={platoonTargeted}
                  label={
                    platoonTargeted && activeSoldier
                      ? `ADD ${activeSoldier.last_name}, ${activeSoldier.first_name} TO ${platoonLabel(pGroup.platoon).toUpperCase()}`
                      : platoonLabel(pGroup.platoon).toUpperCase()
                  }
                >
                  {pGroup.squadGroups.map((group) => {
                    const targeted = isReassignTarget(overTarget, pGroup.platoon, group.squad)
                    return (
                      <DroppableSquadSection
                        key={group.squad ?? 'unassigned'}
                        platoon={pGroup.platoon}
                        squad={group.squad}
                        isTarget={targeted}
                        label={
                          targeted && activeSoldier
                            ? `ADD ${activeSoldier.last_name}, ${activeSoldier.first_name} TO ${squadLabel(group.squad).toUpperCase()}, ${platoonLabel(pGroup.platoon).toUpperCase()}`
                            : `${group.squad ?? 'UNASSIGNED'} (${group.soldiers.length})`
                        }
                      >
                        <div className="space-y-2">
                          {group.soldiers.map((s) => (
                            <MobileSoldierCard key={s.id} soldier={s} />
                          ))}
                        </div>
                      </DroppableSquadSection>
                    )
                  })}
                </DroppablePlatoonSection>
              )
            })}
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
              {platoonGroups.map((pGroup) => {
                const platoonTargeted = isReassignTarget(overTarget, pGroup.platoon, null)
                return (
                  // A real <tbody> per platoon/squad (multiple tbody elements are valid HTML) so a
                  // dotted outline can wrap exactly one squad's rows, not the whole table.
                  <Fragment key={pGroup.platoon ?? 'unassigned'}>
                    <tbody>
                      <DroppablePlatoonHeaderRow platoon={pGroup.platoon} isTarget={platoonTargeted}>
                        <td colSpan={6} className="px-4 py-2.5 font-display text-sm font-bold tracking-wide text-ink">
                          {platoonTargeted && activeSoldier
                            ? `ADD ${activeSoldier.last_name}, ${activeSoldier.first_name} TO ${platoonLabel(pGroup.platoon).toUpperCase()} (SQUAD UNASSIGNED)`
                            : platoonLabel(pGroup.platoon).toUpperCase()}
                        </td>
                      </DroppablePlatoonHeaderRow>
                    </tbody>
                    {pGroup.squadGroups.map((group) => {
                      const targeted = isReassignTarget(overTarget, pGroup.platoon, group.squad)
                      return (
                        <tbody
                          key={group.squad ?? 'unassigned'}
                          className={targeted ? 'rounded-xl outline outline-2 -outline-offset-2 outline-dashed outline-accent' : ''}
                        >
                          <DroppableSquadHeaderRow platoon={pGroup.platoon} squad={group.squad} isTarget={targeted}>
                            <td colSpan={6} className="px-4 py-2 pl-8 text-[13px] font-semibold tracking-wide text-ink-muted">
                              {targeted && activeSoldier
                                ? `ADD ${activeSoldier.last_name}, ${activeSoldier.first_name} TO ${squadLabel(group.squad).toUpperCase()}, ${platoonLabel(pGroup.platoon).toUpperCase()}`
                                : `${group.squad ?? 'UNASSIGNED'} (${group.soldiers.length})`}
                            </td>
                          </DroppableSquadHeaderRow>
                          {group.soldiers.map((s) => (
                            <DesktopSoldierRow
                              key={s.id}
                              soldier={s}
                              isTarget={targeted}
                              onOpen={() => navigate(`/admin/roster/${s.id}`)}
                            />
                          ))}
                        </tbody>
                      )
                    })}
                  </Fragment>
                )
              })}
            </table>
          </div>

          <DragOverlay>
            {activeSoldier && (
              <div
                className={`pointer-events-none flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-sm font-bold opacity-0 shadow-lg [animation:logo-pop_0.15s_ease-out_forwards] ${
                  overTarget && 'action' in overTarget ? 'bg-bad-bg text-bad-ink' : 'bg-accent text-accent-ink'
                }`}
              >
                <SoldierAvatar soldier={activeSoldier} className="h-7 w-7" />
                {activeSoldier.last_name}, {activeSoldier.first_name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
