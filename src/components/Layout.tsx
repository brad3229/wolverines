import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export interface NavItem {
  to: string
  label: string
  shortLabel?: string
  icon: ReactNode
  badge?: number
}

function NavBadge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="ml-auto flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-warn-bg px-1 text-[10px] font-bold text-warn-ink">
      {count}
    </span>
  )
}

interface LayoutProps {
  navItems: NavItem[]
  children: ReactNode
  // Bottom tab bars get cramped once a role has more than a handful of nav items
  // (admin's is up to 7) -- 'menu' swaps mobile nav for a hamburger dropdown instead.
  mobileNav?: 'tabs' | 'menu'
}

export function Layout({ navItems, children, mobileNav = 'tabs' }: LayoutProps) {
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

  return (
    <div className="flex h-screen h-dvh flex-col overflow-hidden bg-surface text-ink">
      <header className="sticky top-0 z-30 flex h-[60px] flex-shrink-0 items-center justify-between border-b border-line bg-surface-raised px-4">
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
          <button
            onClick={() => supabase.auth.signOut()}
            className={`rounded-md bg-neutral-bg px-3 py-1.5 text-xs font-semibold tracking-wide text-neutral-ink transition-colors hover:bg-line ${
              mobileNav === 'menu' ? 'hidden md:inline-flex' : ''
            }`}
          >
            SIGN OUT
          </button>
          {mobileNav === 'menu' && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-dim hover:bg-line-soft md:hidden"
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

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[220px] flex-shrink-0 flex-col gap-1 border-r border-line bg-surface-raised p-2.5 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        </nav>

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
