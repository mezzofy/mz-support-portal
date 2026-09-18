/**
 * SupportTicketDetailPage — Support Console (/support/tickets/:id)
 *
 * Left column: ticket info + merchant identity + status timeline + actions
 * (assign, status transition). Right column: SupportChatPanel (5s polling,
 * replies sent as SUPPORT).
 *
 * NOTE (assumption flagged for Gate 2): the frozen SDL returns no explicit
 * status-history array, so the timeline is derived from the ticket's own
 * timestamps (created / assigned / updated / closed).
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, User, Calendar, Clock, UserCheck, CheckCircle2, Paperclip } from 'lucide-react'
import { DashboardShell } from '../components/DashboardShell'
import { TicketStatusBadge } from '../components/TicketStatusBadge'
import { TicketPriorityBadge } from '../components/TicketPriorityBadge'
import { StatusTransitionMenu } from '../components/StatusTransitionMenu'
import { AssignAgentDialog } from '../components/AssignAgentDialog'
import { SupportChatPanel } from '../components/SupportChatPanel'
import { useTicketDetailViewModel } from '../viewmodels/useTicketDetailViewModel'
import { TicketStatus } from '../../../../domain/entities/support-ticket.entity'
import { formatDateTime } from '../utils/format'

export function SupportTicketDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const vm = useTicketDetailViewModel()
  const [assignOpen, setAssignOpen] = useState(false)

  useEffect(() => {
    if (id) vm.loadTicket(id)
    return () => vm.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const ticket = vm.ticket
  const chatDisabled =
    !!ticket && (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.CANCELLED)

  return (
    <DashboardShell>
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-orange-600"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('support.detail.back')}
        </button>

        {vm.loadingTicket && !ticket ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : vm.error && !ticket ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{vm.error}</p>
          </div>
        ) : ticket ? (
          <>
            {vm.actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-red-800">{vm.actionError}</p>
                <button
                  onClick={vm.clearActionError}
                  className="text-xs text-red-600 underline"
                >
                  {t('support.common.dismiss')}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Left: ticket info + actions */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-gray-400">{ticket.ticketId}</p>
                      <h1 className="text-lg font-bold text-gray-900 mt-0.5">{ticket.subject}</h1>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <TicketStatusBadge status={ticket.status} />
                    <TicketPriorityBadge priority={ticket.priority} />
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {t(`support.type.${ticket.type}`)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">
                    {ticket.description}
                  </p>

                  {ticket.attachments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        {t('support.detail.attachments')}
                      </p>
                      <ul className="space-y-1">
                        {ticket.attachments.map((a) => (
                          <li key={a.id}>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:underline break-all"
                            >
                              <Paperclip className="w-3.5 h-3.5 shrink-0" />
                              {a.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Merchant identity */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    {t('support.detail.merchantIdentity')}
                  </p>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <dt className="text-gray-500 w-24">{t('support.detail.merchant')}</dt>
                      <dd className="text-gray-900 font-medium">{ticket.merchantName}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 shrink-0" />
                      <dt className="text-gray-500 w-24">{t('support.detail.merchantId')}</dt>
                      <dd className="text-gray-600 font-mono text-xs">{ticket.merchantId}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <dt className="text-gray-500 w-24">{t('support.detail.raisedBy')}</dt>
                      <dd className="text-gray-600 font-mono text-xs">{ticket.userId}</dd>
                    </div>
                  </dl>
                </div>

                {/* Assignment + actions */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {t('support.detail.assignment')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm mb-4">
                    <UserCheck className="w-4 h-4 text-gray-400" />
                    {ticket.assigneeId ? (
                      <span className="text-gray-900">
                        {ticket.assigneeName || ticket.assigneeId}
                        {ticket.assignedTeam && (
                          <span className="text-gray-400"> · {ticket.assignedTeam}</span>
                        )}
                      </span>
                    ) : (
                      <span className="italic text-gray-400">{t('support.table.unassigned')}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setAssignOpen(true)}
                      disabled={vm.actionPending}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4" />
                      {t('support.detail.assign')}
                    </button>
                    <StatusTransitionMenu
                      currentStatus={ticket.status}
                      disabled={vm.actionPending}
                      onSelect={(status) => vm.changeStatus(status)}
                    />
                  </div>
                </div>

                {/* Status timeline (derived from timestamps) */}
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    {t('support.detail.timeline')}
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-500 w-28">{t('support.detail.created')}</span>
                      <span className="text-gray-700">{formatDateTime(ticket.createdAt)}</span>
                    </li>
                    {ticket.assignedAt && (
                      <li className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-500 w-28">{t('support.detail.assignedAt')}</span>
                        <span className="text-gray-700">{formatDateTime(ticket.assignedAt)}</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-500 w-28">{t('support.detail.updatedAt')}</span>
                      <span className="text-gray-700">{formatDateTime(ticket.updatedAt)}</span>
                    </li>
                    {ticket.closedAt && (
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-500 w-28">{t('support.detail.closedAt')}</span>
                        <span className="text-gray-700">{formatDateTime(ticket.closedAt)}</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Right: chat */}
              <div className="lg:col-span-3">
                <SupportChatPanel
                  ticketId={ticket.ticketId}
                  messages={vm.messages}
                  loading={vm.loadingMessages}
                  sending={vm.sending}
                  actionError={null}
                  disabled={chatDisabled}
                  onLoadMessages={vm.loadMessages}
                  onSend={vm.sendReply}
                  onMarkRead={vm.markRead}
                />
              </div>
            </div>

            <AssignAgentDialog
              open={assignOpen}
              ticketId={ticket.ticketId}
              pending={vm.actionPending}
              error={vm.actionError}
              onClose={() => setAssignOpen(false)}
              onAssign={async (input) => {
                const ok = await vm.assign(input)
                if (ok) setAssignOpen(false)
              }}
            />
          </>
        ) : null}
      </div>
    </DashboardShell>
  )
}
