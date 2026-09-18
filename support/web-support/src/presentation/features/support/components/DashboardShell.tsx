/**
 * DashboardShell — Support Console
 */
import { DashboardHeader } from './DashboardHeader'
import { DashboardSidebar } from './DashboardSidebar'
import { useLayoutViewModel } from '../viewmodels/useLayoutViewModel'
import { cn } from '../../../../shared/utils/cn'

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { sidebarCollapsed } = useLayoutViewModel()
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <DashboardSidebar />
      <main
        className={cn(
          'pt-16 transition-all duration-300 ml-0',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-60',
        )}
      >
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
