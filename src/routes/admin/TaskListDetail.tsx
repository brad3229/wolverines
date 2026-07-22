import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listSoldiers } from '../../lib/soldiers'
import { ProgressBar } from '../../components/ProgressBar'
import {
  getTaskList,
  updateTaskList,
  deleteTaskList,
  listTaskItems,
  createTaskItem,
  deleteTaskItem,
  reorderTaskItems,
  listCompletionsForList,
  verifyCompletion,
  resetCompletion,
} from '../../lib/tasks'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/errors'
import { BackButton } from '../../components/BackButton'
import type { Soldier, TaskItem, TaskList, SoldierTaskCompletion, TaskCompletionStatus } from '../../types/database'

function completionKey(soldierId: string, taskItemId: string) {
  return `${soldierId}:${taskItemId}`
}

const CHIP_CLASS: Record<TaskCompletionStatus, string> = {
  incomplete: 'border-line bg-neutral-bg text-ink-muted',
  self_reported: 'border-warn-border bg-warn-bg text-warn-ink',
  verified: 'border-transparent bg-good-bg text-good-ink',
}

const CHIP_TITLE: Record<TaskCompletionStatus, string> = {
  incomplete: 'Not done — click to mark verified',
  self_reported: 'Pending verification — click to verify',
  verified: 'Verified — click to reset',
}

export function TaskListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, refreshPendingCounts } = useAuth()
  const [list, setList] = useState<TaskList | null>(null)
  const [items, setItems] = useState<TaskItem[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [completions, setCompletions] = useState<Record<string, SoldierTaskCompletion>>({})
  const [loading, setLoading] = useState(true)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pendingChips, setPendingChips] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    if (!id) return
    setLoading(true)
    Promise.all([getTaskList(id), listTaskItems(id), listSoldiers(), listCompletionsForList(id)]).then(
      ([l, i, s, c]) => {
        setList(l)
        setItems(i)
        setSoldiers(s.filter((soldier) => soldier.status === 'active'))
        setCompletions(Object.fromEntries(c.map((row) => [completionKey(row.soldier_id, row.task_item_id), row])))
        setLoading(false)
      },
    )
  }

  useEffect(refresh, [id])

  if (loading || !list) return <p className="text-sm text-ink-muted">Loading...</p>

  function statusFor(soldierId: string, taskItemId: string): TaskCompletionStatus {
    return completions[completionKey(soldierId, taskItemId)]?.status ?? 'incomplete'
  }

  // Optimistically flips the chip immediately so it doesn't wait on the round trip,
  // then reconciles with the real row or rolls back on failure.
  async function handleChipClick(soldierId: string, taskItemId: string) {
    if (!session) return
    const key = completionKey(soldierId, taskItemId)
    if (pendingChips.has(key)) return
    const current = statusFor(soldierId, taskItemId)
    const previous = completions[key]
    const now = new Date().toISOString()
    setPendingChips((prev) => new Set(prev).add(key))
    setError(null)
    setCompletions((prev) => ({
      ...prev,
      [key]:
        current === 'verified'
          ? {
              id: previous?.id ?? `optimistic-${key}`,
              soldier_id: soldierId,
              task_item_id: taskItemId,
              status: 'incomplete',
              reported_by: null,
              reported_at: null,
              verified_by: null,
              verified_at: null,
              notes: previous?.notes ?? null,
            }
          : {
              id: previous?.id ?? `optimistic-${key}`,
              soldier_id: soldierId,
              task_item_id: taskItemId,
              status: 'verified',
              reported_by: session.user.id,
              reported_at: now,
              verified_by: session.user.id,
              verified_at: now,
              notes: previous?.notes ?? null,
            },
    }))

    try {
      const updated =
        current === 'verified'
          ? await resetCompletion({ soldierId, taskItemId })
          : await verifyCompletion({ soldierId, taskItemId, verifiedBy: session.user.id })
      setCompletions((prev) => ({ ...prev, [key]: updated }))
      refreshPendingCounts()
    } catch (err) {
      setCompletions((prev) => {
        const next = { ...prev }
        if (previous) next[key] = previous
        else delete next[key]
        return next
      })
      setError(errorMessage(err, 'Failed to update task status'))
    } finally {
      setPendingChips((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  async function handleToggleActive() {
    if (!list) return
    const updated = await updateTaskList(list.id, { active: !list.active })
    setList(updated)
  }

  async function handleDelete() {
    if (!list) return
    await deleteTaskList(list.id)
    navigate('/admin/tasks')
  }

  async function handleAddItem() {
    if (!list || !newItemLabel.trim()) return
    await createTaskItem({ taskListId: list.id, label: newItemLabel.trim(), sortOrder: items.length })
    setNewItemLabel('')
    refresh()
  }

  async function handleRemoveItem(itemId: string) {
    await deleteTaskItem(itemId)
    refresh()
  }

  async function handleMoveItem(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const reordered = [...items]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setItems(reordered)
    await reorderTaskItems(reordered.map((i) => i.id))
  }

  return (
    <div className="mx-auto max-w-[960px]">
      <BackButton to="/admin/tasks" label="Back to tasks" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">
            {list.name}
            {!list.active && (
              <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-neutral-ink">
                INACTIVE
              </span>
            )}
          </h1>
          {list.description && <p className="mt-1 text-sm text-ink-muted">{list.description}</p>}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={handleToggleActive}
            className="rounded-md bg-neutral-bg px-3 py-1.5 text-xs font-bold tracking-wide text-neutral-ink"
          >
            {list.active ? 'MARK INACTIVE' : 'MARK ACTIVE'}
          </button>
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md bg-bad-bg px-3 py-1.5 text-xs font-bold tracking-wide text-bad-ink"
            >
              DELETE
            </button>
          ) : (
            <>
              <button
                onClick={handleDelete}
                className="rounded-md bg-bad-bg px-3 py-1.5 text-xs font-bold tracking-wide text-bad-ink"
              >
                CONFIRM DELETE
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md bg-neutral-bg px-3 py-1.5 text-xs font-bold tracking-wide text-neutral-ink"
              >
                CANCEL
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-semibold tracking-wide text-ink-dim">STATIONS</h2>
        {items.length === 0 && <p className="mb-3 text-sm text-ink-muted">No stations yet — add one below.</p>}
        <div className="mb-3 flex flex-col gap-1.5">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2">
              <span className="flex-1 truncate text-sm">{item.label}</span>
              <button
                onClick={() => handleMoveItem(index, -1)}
                disabled={index === 0}
                className="text-ink-muted hover:text-ink-dim disabled:opacity-30"
                aria-label="Move up"
              >
                &uarr;
              </button>
              <button
                onClick={() => handleMoveItem(index, 1)}
                disabled={index === items.length - 1}
                className="text-ink-muted hover:text-ink-dim disabled:opacity-30"
                aria-label="Move down"
              >
                &darr;
              </button>
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="text-xs font-semibold text-bad-ink hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            placeholder="Station name (e.g. Vision, Hearing, Labs)"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemLabel.trim()}
            className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
          >
            + ADD STATION
          </button>
        </div>
      </div>

      <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">SOLDIER PROGRESS</h2>
      {error && <p className="mb-2 text-sm text-bad-ink">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Add stations above to start tracking progress.</p>
      ) : soldiers.length === 0 ? (
        <p className="text-sm text-ink-muted">No active Soldiers on the roster.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {soldiers.map((s) => {
            const verifiedCount = items.filter((i) => statusFor(s.id, i.id) === 'verified').length
            return (
              <div key={s.id} className="rounded-xl border border-line bg-panel p-3.5">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {s.rank} {s.last_name}, {s.first_name}
                  </span>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold ${
                      verifiedCount === items.length ? 'text-good-ink' : 'text-ink-muted'
                    }`}
                  >
                    {verifiedCount}/{items.length} verified
                  </span>
                </div>
                <ProgressBar value={verifiedCount} max={items.length} className="mb-2.5" />
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => {
                    const status = statusFor(s.id, item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleChipClick(s.id, item.id)}
                        disabled={pendingChips.has(completionKey(s.id, item.id))}
                        title={CHIP_TITLE[status]}
                        className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${CHIP_CLASS[status]} ${
                          pendingChips.has(completionKey(s.id, item.id)) ? 'opacity-50' : ''
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
