import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTaskLists, createTaskList, listTaskItems } from '../../lib/tasks'
import { useAuth } from '../../hooks/useAuth'
import type { TaskList } from '../../types/database'

export function TaskLists() {
  const { session } = useAuth()
  const [lists, setLists] = useState<TaskList[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function refresh() {
    setLoading(true)
    listTaskLists().then(async (all) => {
      setLists(all)
      const counts = await Promise.all(all.map((l) => listTaskItems(l.id)))
      setItemCounts(Object.fromEntries(all.map((l, i) => [l.id, counts[i].length])))
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  async function handleCreate() {
    if (!session || !name.trim()) return
    await createTaskList({ name: name.trim(), description: description.trim() || null, createdBy: session.user.id })
    setName('')
    setDescription('')
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
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="self-start rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
          >
            CREATE
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading...</p>
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
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{l.name}</span>
                  {!l.active && (
                    <span className="flex-shrink-0 rounded-md bg-neutral-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-ink">
                      INACTIVE
                    </span>
                  )}
                </div>
                {l.description && <div className="truncate text-xs text-ink-muted">{l.description}</div>}
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
