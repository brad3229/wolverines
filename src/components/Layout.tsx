import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { NotificationBell } from './NotificationBell'

export interface NavItem {
  to: string
  label: string
  shortLabel?: string
  icon: ReactNode
  badge?: number
  // Consecutive items sharing a group render under a shared section label in
  // the desktop rail. Items without one render flat (used for the Soldier
  // nav, which is short enough not to need sections).
  group?: string
}

function NavBadge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="ml-auto flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-warn-bg px-1 text-[10px] font-bold text-warn-ink">
      {count}
    </span>
  )
}

// Groups consecutive nav items that share a `group` value into sections,
// preserving order. Items with no group (or a run of one) render under a
// null-named section, which the rail renders without a label.
function groupNavItems(items: NavItem[]): { name: string | null; items: NavItem[] }[] {
  const groups: { name: string | null; items: NavItem[] }[] = []
  for (const item of items) {
    const name = item.group ?? null
    const last = groups[groups.length - 1]
    if (last && last.name === name) {
      last.items.push(item)
    } else {
      groups.push({ name, items: [item] })
    }
  }
  return groups
}

interface LayoutProps {
  navItems: NavItem[]
  children: ReactNode
  // Bottom tab bars get cramped once a role has more than a handful of nav items
  // (admin's is up to 7) -- 'menu' swaps mobile nav for a hamburger dropdown instead.
  mobileNav?: 'tabs' | 'menu'
}

export function Layout({ navItems, children, mobileNav = 'tabs' }: LayoutProps) {
  const { session } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Overlay dropdown, not part of document flow -- closing on scroll keeps it from
  // sitting stranded over content the user has since scrolled away from.
  useEffect(() => {
    if (!menuOpen) return
    const el = mainRef.current
    if (!el) return
    const close = () => setMenuOpen(false)
    el.addEventListener('scroll', close, { passive: true })
    return () => el.removeEventListener('scroll', close)
  }, [menuOpen])

  // Longest-prefix match against the current route -- gives detail sub-pages
  // (e.g. a Soldier's own page under /admin/roster/:id) the label of their
  // parent section rather than showing nothing.
  const activeItem = [...navItems]
    .filter((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const navGroups = groupNavItems(navItems)

  return (
    <div className="flex h-screen h-dvh flex-col overflow-hidden bg-surface text-ink md:flex-row">
      {/* ===== Mobile header (branding + actions) -- desktop uses the rail + topbar below ===== */}
      <header className="sticky top-0 z-30 flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-raised px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-[34px] min-w-[34px] flex-shrink-0 items-center justify-center rounded-md bg-accent px-1.5 font-display text-xs font-bold text-accent-ink">
            ACO
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold leading-tight tracking-wide">
              A CO 1-120 IN
            </div>
            <div className="truncate text-[11px] tracking-wide text-ink-muted">ROSTER &amp; ATTENDANCE</div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => supabase.auth.signOut()}
            className={`rounded-md bg-neutral-bg px-3 py-1.5 text-xs font-semibold tracking-wide text-neutral-ink transition-colors hover:bg-line ${
              mobileNav === 'menu' ? 'hidden' : ''
            }`}
          >
            SIGN OUT
          </button>
          {mobileNav === 'menu' && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-dim hover:bg-line-soft"
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
        </div>
      </header>

      {mobileNav === 'menu' && menuOpen && (
        <>
          <div className="fixed inset-x-0 top-[60px] bottom-0 z-10 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />
          <nav className="fixed inset-x-0 top-[60px] z-20 flex flex-col gap-1 border-b border-line bg-surface-raised p-2.5 shadow-lg md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold tracking-wide transition-colors ${
                    isActive ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-dim hover:bg-line-soft'
                  }`
                }
              >
                {item.icon}
                {item.label}
                <NavBadge count={item.badge} />
              </NavLink>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold tracking-wide text-bad-ink hover:bg-line-soft"
            >
              SIGN OUT
            </button>
          </nav>
        </>
      )}

      {/* ===== Desktop command rail ===== */}
      <nav className="hidden w-[236px] flex-shrink-0 flex-col bg-rail md:flex">
        <div className="flex items-center gap-2.5 border-b border-rail-line px-4 py-4">
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-md bg-accent font-display text-xs font-bold text-accent-ink">
            ACO
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-[14px] font-semibold leading-tight tracking-wide">
              A CO 1-120 IN
            </div>
            <div className="truncate text-[10px] tracking-wide text-ink-muted">ROSTER &amp; ATTENDANCE</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          {navGroups.map((group, gi) => (
            <div key={gi} className="mt-[18px] first:mt-0">
              {group.name && (
                <div className="mb-1.5 px-2.5 font-display text-[10px] font-semibold tracking-[0.12em] text-ink-faint">
                  {group.name}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold tracking-wide transition-colors ${
                      isActive ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-muted hover:bg-rail-hover hover:text-ink-dim'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                  <NavBadge count={item.badge} />
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-t border-rail-line p-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-accent-ink">
            {(session?.user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink-dim">
            {session?.user.email ?? 'Signed in'}
          </div>
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* ===== Desktop topbar ===== */}
        <div className="hidden h-14 flex-shrink-0 items-center gap-3.5 border-b border-line bg-surface-raised px-7 md:flex">
          {activeItem && (
            <div className="font-display text-xl font-semibold uppercase tracking-wide text-ink">{activeItem.label}</div>
          )}
          <div className="border-l border-line pl-3.5 text-sm text-ink-dim">{todayLabel}</div>
          <div className="ml-auto flex items-center gap-2.5">
            <NotificationBell />
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md bg-neutral-bg px-3 py-1.5 text-xs font-semibold tracking-wide text-neutral-ink transition-colors hover:bg-line"
            >
              SIGN OUT
            </button>
          </div>
        </div>

        <main
          ref={mainRef}
          className={`min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-7 md:pb-7 ${
            mobileNav === 'tabs' ? 'pb-24' : ''
          }`}
        >
          {children}
        </main>
      </div>

      {mobileNav === 'tabs' && (
        <nav className="sticky bottom-0 z-20 flex flex-shrink-0 border-t border-line bg-surface-raised md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold tracking-wide ${
                  isActive ? 'text-accent' : 'text-ink-muted'
                }`
              }
            >
              {item.icon}
              {item.shortLabel ?? item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
