import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { markNotificationRead, markAllNotificationsRead } from '../lib/notifications'
import { IconBell } from './icons'
import type { Notification } from '../types/database'

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationBell() {
  const { session, notifications, notificationsError, removeNotification, clearNotifications } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const unreadCount = notifications.length

  // Read notifications disappear from the list immediately -- they're gone for good,
  // not just dimmed/marked, since there's nothing left to act on once you've seen them.
  async function handleSelect(n: Notification) {
    setOpen(false)
    removeNotification(n.id)
    markNotificationRead(n.id).catch(() => {})
    if (n.link) navigate(n.link)
  }

  async function handleMarkAllRead() {
    if (!session) return
    clearNotifications()
    markAllNotificationsRead(session.user.id).catch(() => {})
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-dim hover:bg-line-soft"
      >
        <IconBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn-bg px-1 text-[9px] font-bold text-warn-ink">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[60px] z-30 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-line bg-surface-raised shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-11 md:w-[320px]">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="font-display text-sm font-semibold tracking-wide">NOTIFICATIONS</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-accent-soft-ink hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {notificationsError ? (
              <p className="p-4 text-center text-sm text-bad-ink">Couldn&rsquo;t load notifications.</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-ink-muted">Nothing new — you're all caught up.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleSelect(n)}
                  className="flex w-full flex-col gap-0.5 border-b border-line-soft bg-accent-soft/10 px-3.5 py-2.5 text-left last:border-0 hover:bg-surface"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold">{n.title}</span>
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  </div>
                  <span className="text-xs text-ink-muted">{n.body}</span>
                  <span className="text-[10px] text-ink-faint">{timeAgo(n.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
