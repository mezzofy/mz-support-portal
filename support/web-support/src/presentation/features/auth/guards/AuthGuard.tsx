/**
 * AuthGuard — Support Console
 * Protected route wrapper; redirects to the IAM staff login when unauthenticated.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, logout } from '../hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { t } = useTranslation()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, loading])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-orange-600 mx-auto mb-4" />
          <p className="text-sm text-gray-600">{t('support.auth.verifying')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
