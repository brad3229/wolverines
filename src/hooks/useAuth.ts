import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { listSutaRequests } from '../lib/sutaRequests'
import { listEditRequests } from '../lib/editRequests'
import { listPayIssues } from '../lib/payIssues'
import type { UserRole } from '../types/database'

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
  refreshPendingCounts: () => void
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
  refreshPendingCounts: () => {},
})

export function useAuthState(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsMfaChallenge, setNeedsMfaChallenge] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [pendingSutaCount, setPendingSutaCount] = useState(0)
  const [pendingEditRequestCount, setPendingEditRequestCount] = useState(0)
  const [pendingPayIssueCount, setPendingPayIssueCount] = useState(0)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
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
  }, [session])

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
      return
    }
    listSutaRequests().then((all) => setPendingSutaCount(all.filter((r) => r.status === 'pending').length))
    listEditRequests().then((all) => setPendingEditRequestCount(all.filter((r) => r.status === 'pending').length))
    listPayIssues().then((all) => setPendingPayIssueCount(all.filter((i) => i.status === 'open').length))
  }, [role])

  // Drives the "Review SUTA", "Dashboard", and "Pay Issues" nav badges -- re-fetched whenever
  // admin status is (re)established. Pages that change SUTA/edit-request/pay-issue status call
  // refreshPendingCounts() themselves afterward so the badges don't wait for a full reload to catch up.
  useEffect(refreshPendingCounts, [refreshPendingCounts])

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
    refreshPendingCounts,
  }
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
