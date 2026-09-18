/**
 * StatusTransitionMenu — Support Console
 * Shows ONLY the target statuses allowed by STATUS_TRANSITIONS for the
 * ticket's current status. Terminal states (CLOSED/CANCELLED) show a disabled
 * "no transitions" state. The backend re-validates the chosen transition.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ArrowRightLeft } from 'lucide-react'
import {
  STATUS_TRANSITIONS,
  TicketStatus,
} from '../../../../domain/entities/support-ticket.entity'

interface Props {
  currentStatus: TicketStatus
  disabled?: boolean
  onSelect: (status: TicketStatus) => void
}

export function StatusTransitionMenu({ currentStatus, disabled, onSelect }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const targets = STATUS_TRANSITIONS[currentStatus] || []
  const isTerminal = targets.length === 0

  return (
    <div className="relative">
      <button
        onClick={() => !isTerminal && setOpen((v) => !v)}
        disabled={disabled || isTerminal}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ArrowRightLeft className="w-4 h-4 text-orange-600" />
        {t('support.detail.changeStatus')}
        {!isTerminal && <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isTerminal && (
        <p className="mt-1 text-xs text-gray-400">{t('support.detail.terminalStatus')}</p>
      )}

      {open && !isTerminal && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1"
            role="menu"
          >
            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {t('support.detail.moveTo')}
            </p>
            {targets.map((status) => (
              <button
                key={status}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSelect(status)
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
              >
                {t(`support.status.${status}`)}
                {currentStatus === TicketStatus.RESOLVED && status === TicketStatus.IN_PROGRESS && (
                  <span className="ml-1 text-xs text-gray-400">({t('support.detail.reopen')})</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
