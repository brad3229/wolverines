import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { listSutaRequests } from '../lib/sutaRequests'
import { listEditRequests } from '../lib/editRequests'
import { listPayIssues } from '../lib/payIssues'
import { listGearRequests } from '../lib/gearRequests'
import { countPendingTaskVerifications } from '../lib/tasks'
import { listUnreadNotifications } from '../lib/notifications'
import type { UserRole, Notification } from '../types/database'

interface AuthState {
  session: Session | null
  role: UserRole | null
  loading: boolean
  needsMfaChallenge: boolean
  mfaFactorId: string | null
  clearMfaChallenge: () => void
  pendingSutaCount: number
  pendingEditRequestCount: number
  pendingPayIssueCount: number
  pendingTaskVerificationCount: number
  pendingGearRequestCount: number
  refreshPendingCounts: () => void
  notifications: Notification[]
  notificationsError: boolean
  refreshNotifications: () => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
  needsMfaChallenge: false,
  mfaFactorId: null,
  clearMfaChallenge: () => {},
  pendingSutaCount: 0,
  pendingEditRequestCount: 0,
  pendingPayIssueCount: 0,
  pendingTaskVerificationCount: 0,
  pendingGearRequestCount: 0,
  refreshPendingCounts: () => {},
  notifications: [],
  notificationsError: false,
  refreshNotifications: () => {},
  removeNotification: () => {},
  clearNotifications: () => {},
})

export function useAuthState(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  // `session` starts null before the async getSession() below resolves, which looks
  // identical to "definitely logged out" -- this tracks whether that initial check has
  // actually happened yet, so a refresh doesn't briefly bounce a real session to /login.
  const [sessionChecked, setSessionChecked] = useState(false)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsMfaChallenge, setNeedsMfaChallenge] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [pendingSutaCount, setPendingSutaCount] = useState(0)
  const [pendingEditRequestCount, setPendingEditRequestCount] = useState(0)
  const [pendingPayIssueCount, setPendingPayIssueCount] = useState(0)
  const [pendingTaskVerificationCount, setPendingTaskVerificationCount] = useState(0)
  const [pendingGearRequestCount, setPendingGearRequestCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsError, setNotificationsError] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionChecked(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionChecked(true)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionChecked) return

    if (!session) {
      setRole(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        setRole(error ? null : (data?.role ?? null))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, sessionChecked])

  // A Soldier can be signed in (aal1, password only) but still owe a second factor
  // if their account has a verified TOTP factor enrolled -- block on that here so
  // no protected route ever renders before it's satisfied.
  useEffect(() => {
    if (!session) {
      setNeedsMfaChallenge(false)
      setMfaFactorId(null)
      return
    }

    let active = true

    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!active || !data) return
      if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
        supabase.auth.mfa.listFactors().then(({ data: factorData }) => {
          if (!active) return
          const factor = factorData?.totp.find((f) => f.status === 'verified')
          setMfaFactorId(factor?.id ?? null)
          setNeedsMfaChallenge(true)
        })
      } else {
        setNeedsMfaChallenge(false)
        setMfaFactorId(null)
      }
    })

    return () => {
      active = false
    }
  }, [session])

  const refreshPendingCounts = useCallback(() => {
    if (role !== 'admin') {
      setPendingSutaCount(0)
      setPendingEditRequestCount(0)
      setPendingPayIssueCount(0)
      setPendingTaskVerificationCount(0)
      setPendingGearRequestCount(0)
      return
    }
    listSutaRequests().then((all) => setPendingSutaCount(all.filter((r) => r.status === 'pending').length))
    listEditRequests().then((all) => setPendingEditRequestCount(all.filter((r) => r.status === 'pending').length))
    listPayIssues().then((all) => setPendingPayIssueCount(all.filter((i) => i.status === 'open').length))
    countPendingTaskVerifications().then(setPendingTaskVerificationCount)
    listGearRequests().then((all) => setPendingGearRequestCount(all.filter((r) => r.status === 'open').length))
  }, [role])

  // Drives the "Review SUTA", "Dashboard", and "Pay Issues" nav badges -- re-fetched whenever
  // admin status is (re)established. Pages that change SUTA/edit-request/pay-issue status call
  // refreshPendingCounts() themselves afterward so the badges don't wait for a full reload to catch up.
  useEffect(refreshPendingCounts, [refreshPendingCounts])

  // Lives here (not in NotificationBell) so it's fetched once per session instead of on
  // every navigation -- Layout, and everything inside it, remounts per route since it's
  // instantiated per <Route> rather than via a persistent <Outlet>.
  const refreshNotifications = useCallback(() => {
    if (!session) {
      setNotifications([])
      setNotificationsError(false)
      return
    }
    setNotificationsError(false)
    listUnreadNotifications(session.user.id)
      .then(setNotifications)
      .catch(() => setNotificationsError(true))
  }, [session])

  useEffect(refreshNotifications, [refreshNotifications])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    session,
    role,
    loading,
    needsMfaChallenge,
    mfaFactorId,
    clearMfaChallenge: () => setNeedsMfaChallenge(false),
    pendingSutaCount,
    pendingEditRequestCount,
    pendingPayIssueCount,
    pendingTaskVerificationCount,
    pendingGearRequestCount,
    refreshPendingCounts,
    notifications,
    notificationsError,
    refreshNotifications,
    removeNotification,
    clearNotifications,
  }
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
