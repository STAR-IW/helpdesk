import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useSession } from '../lib/auth-client'

export function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode
  role?: string
}) {
  const { data:
      session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (role && session.user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
