/**
 * DashboardHeader — Support Console
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, User, LogOut, ChevronDown, Languages } from 'lucide-react'
import { Logo } from '../../../../shared/components/Logo'
import { useAuth, logout } from '../../auth/hooks/useAuth'
import { useLayoutViewModel } from '../viewmodels/useLayoutViewModel'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../../../i18n/config'
import i18n from '../../../../i18n/config'

export function DashboardHeader() {
  const { t } = useTranslation()
  const { agent } = useAuth()
  const { toggleSidebar, toggleMobileMenu } = useLayoutViewModel()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)

  const changeLanguage = (lng: SupportedLanguage) => {
    i18n.changeLanguage(lng)
    setLangMenuOpen(false)
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg hover:bg-gray-100 md:hidden"
            aria-label={t('support.header.toggleMenu')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={toggleSidebar}
            className="hidden md:block p-2 rounded-lg hover:bg-gray-100"
            aria-label={t('support.header.toggleSidebar')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Logo className="hidden sm:flex" />
        </div>

        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen((v) => !v)}
              className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label={t('support.language.select')}
            >
              <Languages className="w-5 h-5" />
              <ChevronDown className="hidden md:block w-3.5 h-3.5 text-gray-400" />
            </button>
            {langMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                  {(Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]).map((lng) => (
                    <button
                      key={lng}
                      onClick={() => changeLanguage(lng)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {SUPPORTED_LANGUAGES[lng]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Agent menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {agent?.agentName || t('support.header.agent')}
              </span>
              <ChevronDown className="hidden md:block w-4 h-4 text-gray-400" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {agent?.agentName || t('support.header.agent')}
                    </p>
                    <p className="text-xs text-gray-600">{agent?.email || ''}</p>
                    {agent?.team && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        {t('support.header.team')}: {agent.team}
                      </p>
                    )}
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => logout()}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('support.header.signOut')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
