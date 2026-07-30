import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTaskLists, createTaskList, listTaskItems, listAssignedSoldierIds } from '../../lib/tasks'
import { listSoldiers } from '../../lib/soldiers'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/errors'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { Soldier, TaskList } from '../../types/database'

export function TaskLists() {
  const { session } = useAuth()
  const [lists, setLists] = useState<TaskList[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [assignedNamesByList, setAssignedNamesByList] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [assignScope, setAssignScope] = useState<'all' | 'specific'>('all')
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<Set<string>>(new Set())

  function refresh() {
    setLoading(true)
    setLoadError(null)
    Promise.all([listTaskLists(), listSoldiers()])
      .then(async ([all, soldierData]) => {
        setLists(all)
        setSoldiers(soldierData.filter((s) => s.status === 'active'))
        const counts = await Promise.all(all.map((l) => listTaskItems(l.id)))
        setItemCounts(Object.fromEntries(all.map((l, i) => [l.id, counts[i].length])))

        const specificLists = all.filter((l) => !l.assigned_to_all)
        const assignedIdsByList = await Promise.all(specificLists.map((l) => listAssignedSoldierIds(l.id)))
        const soldierName = (id: string) => {
          const s = soldierData.find((soldier) => soldier.id === id)
          return s ? `${s.rank} ${s.last_name}, ${s.first_name}` : 'Unknown Soldier'
        }
        setAssignedNamesByList(
          Object.fromEntries(
            specificLists.map((l, i) => [l.id, assignedIdsByList[i].map(soldierName).join('; ')]),
          ),
        )

        setLoading(false)
      })
      .catch((err) => {
        setLoadError(errorMessage(err, 'Failed to load task lists'))
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  function toggleSelectedSoldier(id: string) {
    setSelectedSoldierIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!session || !name.trim()) return
    await createTaskList({
      name: name.trim(),
      description: description.trim() || null,
      createdBy: session.user.id,
      assignedToAll: assignScope === 'all',
      soldierIds: assignScope === 'specific' ? Array.from(selectedSoldierIds) : undefined,
    })
    setName('')
    setDescription('')
    setAssignScope('all')
    setSelectedSoldierIds(new Set())
    setShowAddForm(false)
    refresh()
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Tasks</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Track custom, multi-step requirements per soldier</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showAddForm ? 'CANCEL' : '+ NEW TASK LIST'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <input
            placeholder="Name (e.g. PHA)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />

          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">ASSIGN TO</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignScope('all')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold tracking-wide ${
                  assignScope === 'all'
                    ? 'border-accent bg-accent-soft text-accent-soft-ink'
                    : 'border-line bg-neutral-bg text-ink-muted'
                }`}
              >
                WHOLE PLATOON
              </button>
              <button
                type="button"
                onClick={() => setAssignScope('specific')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold tracking-wide ${
                  assignScope === 'specific'
                    ? 'border-accent bg-accent-soft text-accent-soft-ink'
                    : 'border-line bg-neutral-bg text-ink-muted'
                }`}
              >
                SPECIFIC SOLDIERS
              </button>
            </div>
          </div>

          {assignScope === 'specific' && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-line bg-surface p-2">
              {soldiers.length === 0 ? (
                <p className="p-2 text-sm text-ink-muted">No active Soldiers on the roster.</p>
              ) : (
                soldiers.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-raised"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSoldierIds.has(s.id)}
                      onChange={() => toggleSelectedSoldier(s.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    {s.rank} {s.last_name}, {s.first_name}
                  </label>
                ))
              )}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!name.trim() || (assignScope === 'specific' && selectedSoldierIds.size === 0)}
            className="self-start rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
          >
            CREATE
          </button>
        </div>
      )}

      {loadError && <p className="mb-4 text-sm text-bad-ink">{loadError}</p>}

      {loading ? (
        <LoadingScreen />
      ) : lists.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-ink-muted">
          No task lists yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lists.map((l) => (
            <Link
              key={l.id}
              to={`/admin/tasks/${l.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{l.name}</span>
                  {!l.active && (
                    <span className="flex-shrink-0 rounded-md bg-neutral-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-ink">
                      INACTIVE
                    </span>
                  )}
                  {!l.assigned_to_all && (
                    <span className="flex-shrink-0 rounded-md bg-info-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-info-ink">
                      SELECTED SOLDIERS
                    </span>
                  )}
                </div>
                {l.description && <div className="truncate text-xs text-ink-muted">{l.description}</div>}
                {!l.assigned_to_all && (
                  <div className="truncate text-xs text-info-ink">
                    Assigned to: {assignedNamesByList[l.id] || 'No one yet'}
                  </div>
                )}
              </div>
              <span className="flex-shrink-0 text-xs text-ink-muted">
                {itemCounts[l.id] ?? 0} station{itemCounts[l.id] === 1 ? '' : 's'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
