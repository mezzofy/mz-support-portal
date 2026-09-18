/**
 * AssignAgentDialog — Support Console
 *
 * Assigns a ticket via assignTicket(input). The frozen SDL exposes no
 * "list agents" query, so the dialog offers:
 *   1. "Assign to me" (default) using the signed-in agent identity, and
 *   2. a manual entry (agent id + name + team) for assigning to a colleague.
 * (Assumption flagged to Lead for Gate 2 — no agent-directory query exists.)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, UserCheck } from 'lucide-react'
import { StaffTeam } from '../../../../domain/entities/agent.entity'
import { useAuth } from '../../auth/hooks/useAuth'
import type { AssignTicketInput } from '../../../../domain/repositories/support-ticket.repository.interface'

interface Props {
  open: boolean
  ticketId: string
  pending?: boolean
  error?: string | null
  onClose: () => void
  onAssign: (input: AssignTicketInput) => void
}

export function AssignAgentDialog({ open, ticketId, pending, error, onClose, onAssign }: Props) {
  const { t } = useTranslation()
  const { agent } = useAuth()
  const [mode, setMode] = useState<'me' | 'other'>('me')
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [team, setTeam] = useState<string>(agent?.team || StaffTeam.SUPPORT)

  if (!open) return null

  const submit = () => {
    if (mode === 'me') {
      if (!agent) return
      onAssign({
        ticketId,
        assigneeId: agent.agentId,
        assigneeName: agent.agentName,
        assignedTeam: agent.team || StaffTeam.SUPPORT,
      })
    } else {
      if (!agentId.trim()) return
      onAssign({
        ticketId,
        assigneeId: agentId.trim(),
        assigneeName: agentName.trim() || undefined,
        assignedTeam: team || undefined,
      })
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('support.assign.title')}
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100"
          aria-label={t('support.header.close')}
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{t('support.assign.title')}</h2>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('me')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                mode === 'me'
                  ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('support.assign.toMe')}
            </button>
            <button
              onClick={() => setMode('other')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                mode === 'other'
                  ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('support.assign.toOther')}
            </button>
          </div>

          {mode === 'me' ? (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
              <p className="font-medium text-gray-900">{agent?.agentName || '—'}</p>
              <p className="text-gray-500 text-xs">{agent?.email || ''}</p>
              {agent?.team && (
                <p className="text-orange-600 text-xs mt-1">
                  {t('support.header.team')}: {agent.team}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('support.assign.agentId')} *
                </label>
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={inputClass}
                  placeholder="user-..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('support.assign.agentName')}
                </label>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('support.assign.team')}
                </label>
                <select value={team} onChange={(e) => setTeam(e.target.value)} className={inputClass}>
                  {Object.values(StaffTeam).map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('support.common.cancel')}
            </button>
            <button
              onClick={submit}
              disabled={pending || (mode === 'other' && !agentId.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? t('support.common.saving') : t('support.assign.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
