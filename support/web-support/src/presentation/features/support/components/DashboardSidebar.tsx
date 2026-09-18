/**
 * DashboardSidebar — Support Console
 * Internal staff tool: navigation is limited to the console's own views
 * (Queue + My Assigned) via react-router. No cross-portal gateway links.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { Inbox, UserCheck, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../../../shared/utils/cn'
import { useLayoutViewModel } from '../viewmodels/useLayoutViewModel'

interface MenuItem {
  id: string
  label: string
  icon: typeof Inbox
  path: string
}

export function DashboardSidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, mobileMenuOpen, setMobileMenuOpen, toggleSidebar } = useLayoutViewModel()

  const menuItems: MenuItem[] = [
    { id: 'queue', label: t('support.nav.queue'), icon: Inbox, path: '/queue' },
    { id: 'my', label: t('support.nav.myAssigned'), icon: UserCheck, path: '/my' },
  ]

  const handleNavigate = (item: MenuItem) => {
    navigate(item.path)
    setMobileMenuOpen(false)
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed left-0 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
          'top-0 h-screen z-50',
          mobileMenuOpen ? 'translate-x-0 w-60' : '-translate-x-full',
          'md:translate-x-0 md:top-16 md:h-[calc(100vh-64px)] md:z-40',
          sidebarCollapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        {mobileMenuOpen && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 md:hidden"
            aria-label={t('support.header.close')}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <nav className="flex flex-col gap-1 p-4 mt-16 md:mt-4 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item)}
                className={cn(
                  'flex items-center gap-3 py-2.5 rounded-lg transition-colors',
                  sidebarCollapsed ? 'px-0 justify-center' : 'px-3',
                  'hover:bg-gray-100',
                  active && 'bg-orange-50 text-orange-600 font-medium',
                  !active && 'text-gray-700',
                )}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('w-5 h-5', active && 'text-orange-600')} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="hidden md:block border-t border-gray-200">
          <button
            onClick={toggleSidebar}
            className="w-full h-12 flex items-center gap-2 px-4 transition-colors hover:bg-gray-100 text-gray-600"
            aria-label={sidebarCollapsed ? t('support.sidebar.expand') : t('support.sidebar.collapse')}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 mx-auto" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">{t('support.footer.version')} 1.0.0</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
