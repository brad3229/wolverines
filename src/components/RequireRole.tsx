import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types/database'

interface RequireRoleProps {
  allow: UserRole[]
  children: ReactNode
}

export function RequireRole({ allow, children }: RequireRoleProps) {
  const { session, role, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!role || !allow.includes(role)) return <Navigate to="/login" replace />

  return <>{children}</>
}
