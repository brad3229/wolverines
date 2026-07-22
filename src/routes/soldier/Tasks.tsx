import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { listActiveTaskLists, listTaskItems, listOwnCompletions, reportOwnCompletion, retractOwnCompletion } from '../../lib/tasks'
import { ProgressBar } from '../../components/ProgressBar'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/errors'
import type { Soldier, TaskList, TaskItem, SoldierTaskCompletion, TaskCompletionStatus } from '../../types/database'

export function Tasks() {
  const { session } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [lists, setLists] = useState<TaskList[]>([])
  const [itemsByList, setItemsByList] = useState<Record<string, TaskItem[]>>({})
  const [completions, setCompletions] = useState<Record<string, SoldierTaskCompletion>>({})
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!session) return
    setLoading(true)
    setNotLinked(false)
    try {
      const s = await getOwnSoldierRecord(session.user.id)
      setSoldier(s)
      const activeLists = await listActiveTaskLists()
      setLists(activeLists)
      const itemLists = await Promise.all(activeLists.map((l) => listTaskItems(l.id)))
      setItemsByList(Object.fromEntries(activeLists.map((l, i) => [l.id, itemLists[i]])))
      const own = await listOwnCompletions(s.id)
      setCompletions(Object.fromEntries(own.map((c) => [c.task_item_id, c])))
    } catch {
      setNotLinked(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  if (loading) return <p className="text-sm text-ink-muted">Loading...</p>

  if (notLinked || !soldier) {
    return (
      <div className="mx-auto max-w-[680px]">
        <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:mb-5 sm:text-[26px]">
          Tasks
        </h1>
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so there&rsquo;s nothing to track yet.
          Ask an admin to add you to the Roster and link your account to it.
        </div>
      </div>
    )
  }

  // Optimistically flips the chip immediately so it doesn't wait on the round trip,
  // then reconciles with the real row or rolls back on failure.
  async function handleClick(item: TaskItem, status: TaskCompletionStatus) {
    if (!soldier || !session || status === 'verified' || pending.has(item.id)) return
    const previous = completions[item.id]
    const now = new Date().toISOString()
    setPending((prev) => new Set(prev).add(item.id))
    setError(null)
    setCompletions((prev) => ({
      ...prev,
      [item.id]:
        status === 'incomplete'
          ? {
              id: previous?.id ?? `optimistic-${item.id}`,
              soldier_id: soldier.id,
              task_item_id: item.id,
              status: 'self_reported',
              reported_by: session.user.id,
              reported_at: now,
              verified_by: null,
              verified_at: null,
              notes: previous?.notes ?? null,
            }
          : {
              id: previous?.id ?? `optimistic-${item.id}`,
              soldier_id: soldier.id,
              task_item_id: item.id,
              status: 'incomplete',
              reported_by: null,
              reported_at: null,
              verified_by: null,
              verified_at: null,
              notes: previous?.notes ?? null,
            },
    }))

    try {
      const updated =
        status === 'incomplete'
          ? await reportOwnCompletion({ soldierId: soldier.id, taskItemId: item.id, reportedBy: session.user.id })
          : await retractOwnCompletion({ soldierId: soldier.id, taskItemId: item.id })
      setCompletions((prev) => ({ ...prev, [item.id]: updated }))
    } catch (err) {
      setCompletions((prev) => {
        const next = { ...prev }
        if (previous) next[item.id] = previous
        else delete next[item.id]
        return next
      })
      setError(errorMessage(err, 'Failed to update task status'))
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <h1 className="mb-1 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">Tasks</h1>
      <p className="mb-5 text-[13px] text-ink-muted">
        Tap a station to report it done. An admin will verify it before it counts as complete.
      </p>
      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      {lists.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-ink-muted">
          No active task lists right now.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {lists.map((list) => {
            const items = itemsByList[list.id] ?? []
            const verifiedCount = items.filter((i) => completions[i.id]?.status === 'verified').length
            return (
              <div key={list.id} className="rounded-xl border border-line bg-panel p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{list.name}</div>
                    {list.description && <div className="text-xs text-ink-muted">{list.description}</div>}
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold ${
                      items.length > 0 && verifiedCount === items.length ? 'text-good-ink' : 'text-ink-muted'
                    }`}
                  >
                    {verifiedCount}/{items.length} verified
                  </span>
                </div>
                <ProgressBar value={verifiedCount} max={items.length} className="mb-3" />
                {items.length === 0 ? (
                  <p className="text-sm text-ink-muted">No stations defined yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {items.map((item) => {
                      const status = completions[item.id]?.status ?? 'incomplete'
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleClick(item, status)}
                          disabled={status === 'verified' || pending.has(item.id)}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            pending.has(item.id) ? 'opacity-50' : ''
                          } ${
                            status === 'verified'
                              ? 'border-transparent bg-good-bg text-good-ink'
                              : status === 'self_reported'
                                ? 'border-warn-border bg-warn-bg/10 text-ink'
                                : 'border-line-soft hover:bg-surface-raised'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span
                            className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                              status === 'verified'
                                ? 'bg-good-ink/15 text-good-ink'
                                : status === 'self_reported'
                                  ? 'bg-warn-bg text-warn-ink'
                                  : 'bg-neutral-bg text-neutral-ink'
                            }`}
                          >
                            {status === 'verified' ? 'VERIFIED' : status === 'self_reported' ? 'PENDING' : 'NOT DONE'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
