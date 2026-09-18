/**
 * SupportTicketTable — Support Console
 * Cross-merchant ticket table (Merchant + Assignee columns). Shared by the
 * Queue and MyAssigned pages. Rows navigate to the ticket detail view.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { SupportTicket } from '../../../../domain/entities/support-ticket.entity'
import { TicketStatusBadge } from './TicketStatusBadge'
import { TicketPriorityBadge } from './TicketPriorityBadge'
import { formatDate } from '../utils/format'

interface Props {
  tickets: SupportTicket[]
  loading: boolean
  showAssignee?: boolean
}

export function SupportTicketTable({ tickets, loading, showAssignee = true }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const colCount = showAssignee ? 8 : 7

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.ticketId')}
            </th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.subject')}
            </th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.merchant')}
            </th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.type')}
            </th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.status')}
            </th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.priority')}
            </th>
            {showAssignee && (
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('support.table.assignee')}
              </th>
            )}
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('support.table.updatedAt')}
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={colCount} className="px-6 py-16 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-3" />
                <p className="text-sm text-gray-500">{t('support.common.loading')}</p>
              </td>
            </tr>
          ) : tickets.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-6 py-16 text-center text-gray-500">
                {t('support.queue.noTickets')}
              </td>
            </tr>
          ) : (
            tickets.map((ticket) => (
              <tr
                key={ticket.ticketId}
                onClick={() => navigate(`/tickets/${ticket.ticketId}`)}
                className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                tabIndex={0}
                role="link"
                aria-label={t('support.table.openTicket', { id: ticket.ticketId })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/tickets/${ticket.ticketId}`)
                  }
                }}
              >
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono font-medium text-gray-900">{ticket.ticketId}</span>
                </td>
                <td className="px-4 sm:px-6 py-4">
                  <span className="text-sm text-gray-900 line-clamp-2 max-w-xs">{ticket.subject}</span>
                </td>
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-700">{ticket.merchantName}</span>
                </td>
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{t(`support.type.${ticket.type}`)}</span>
                </td>
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <TicketStatusBadge status={ticket.status} />
                </td>
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <TicketPriorityBadge priority={ticket.priority} />
                </td>
                {showAssignee && (
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    {ticket.assigneeId ? (
                      <span className="text-sm text-gray-700">
                        {ticket.assigneeName || ticket.assigneeId}
                      </span>
                    ) : (
                      <span className="text-xs italic text-gray-400">
                        {t('support.table.unassigned')}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(ticket.updatedAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
