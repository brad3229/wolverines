import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LoadingScreen } from './LoadingScreen'
import type { UserRole } from '../types/database'

interface RequireRoleProps {
  allow: UserRole[]
  children: ReactNode
}

export function RequireRole({ allow, children }: RequireRoleProps) {
  const { session, role, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!role || !allow.includes(role)) return <Navigate to="/login" replace />

  return <>{children}</>
}
