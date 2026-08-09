import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { listSutaRequests } from '../lib/sutaRequests'
import { listEditRequests } from '../lib/editRequests'
import { listPayIssues } from '../lib/payIssues'
import { listGearRequests } from '../lib/gearRequests'
import { countPendingTaskVerifications } from '../lib/tasks'
import { listUnreadNotifications } from '../lib/notifications'
import { getOwnSoldierRecord } from '../lib/soldiers'
import { jwtAmrMethods } from '../lib/jwt'
import type { UserRole, Notification, Soldier } from '../types/database'

interface AuthState {
  session: Session | null
  role: UserRole | null
  soldier: Soldier | null
  refreshSoldier: () => void
  loading: boolean
  needsMfaChallenge: boolean
  mfaFactorId: string | null
  clearMfaChallenge: () => void
  needsMfaEnrollment: boolean
  refreshMfaStatus: () => void
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
  soldier: null,
  refreshSoldier: () => {},
  loading: true,
  needsMfaChallenge: false,
  mfaFactorId: null,
  clearMfaChallenge: () => {},
  needsMfaEnrollment: false,
  refreshMfaStatus: () => {},
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
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsMfaChallenge, setNeedsMfaChallenge] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [needsMfaEnrollment, setNeedsMfaEnrollment] = useState(false)
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
    let attempt = 0
    setLoading(true)

    // A transient failure here (most likely right after a fresh sign-in,
    // before anything has settled) previously gave up silently -- role
    // stayed null with no error shown anywhere, leaving the user stuck
    // looking at the login form with zero indication anything went wrong.
    // A couple of quick retries absorb a one-off blip before giving up.
    function fetchRole() {
      supabase
        .from('profiles')
        .select('role')
        .eq('id', session!.user.id)
        .single()
        .then(({ data, error }) => {
          if (!active) return
          if (error && attempt < 2) {
            attempt += 1
            setTimeout(fetchRole, 500)
            return
          }
          setRole(error ? null : (data?.role ?? null))
          setLoading(false)
        })
    }

    fetchRole()

    return () => {
      active = false
    }
  }, [session, sessionChecked])

  // Lives here (not per-page) so the mobile profile banner in Layout has a name/rank to
  // show without re-fetching on every route change -- Layout remounts per <Route>. Silently
  // null for accounts with no linked Soldier row (e.g. an admin who hasn't self-linked).
  const refreshSoldier = useCallback(() => {
    if (!session) {
      setSoldier(null)
      return
    }
    getOwnSoldierRecord(session.user.id)
      .then(setSoldier)
      .catch(() => setSoldier(null))
  }, [session])

  // Exposed as refreshSoldier so pages that change the Soldier's own row
  // (e.g. uploading an avatar) can pull the update in immediately, instead
  // of it only showing up after the next full session refresh.
  useEffect(refreshSoldier, [refreshSoldier])

  // A Soldier can be signed in (aal1, password only) but still owe a second factor
  // if their account has a verified TOTP factor enrolled -- block on that here so
  // no protected route ever renders before it's satisfied. Admin accounts have a
  // second case: aal1 with *no* factor to step up to at all means MFA is
  // mandatory but never set up -- see needsMfaEnrollment / MfaEnrollmentRequired.
  // A passkey sign-in is exempt from both cases (see is_admin() in SQL for the
  // matching server-side rule) -- it's already phishing-resistant and combines
  // device possession with a biometric/PIN in one ceremony, so it satisfies the
  // admin security bar without a separate TOTP step.
  const refreshMfaStatus = useCallback(() => {
    if (!session) {
      setNeedsMfaChallenge(false)
      setMfaFactorId(null)
      setNeedsMfaEnrollment(false)
      return
    }

    if (jwtAmrMethods(session.access_token).includes('passkey')) {
      setNeedsMfaChallenge(false)
      setMfaFactorId(null)
      setNeedsMfaEnrollment(false)
      return
    }

    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!data) return
      if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
        supabase.auth.mfa.listFactors().then(({ data: factorData }) => {
          const factor = factorData?.totp.find((f) => f.status === 'verified')
          setMfaFactorId(factor?.id ?? null)
          setNeedsMfaChallenge(true)
          setNeedsMfaEnrollment(false)
        })
      } else {
        setNeedsMfaChallenge(false)
        setMfaFactorId(null)
        setNeedsMfaEnrollment(role === 'admin' && data.currentLevel === 'aal1' && data.nextLevel === 'aal1')
      }
    })
  }, [session, role])

  useEffect(refreshMfaStatus, [refreshMfaStatus])

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
    soldier,
    refreshSoldier,
    loading,
    needsMfaChallenge,
    mfaFactorId,
    clearMfaChallenge: () => setNeedsMfaChallenge(false),
    needsMfaEnrollment,
    refreshMfaStatus,
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
