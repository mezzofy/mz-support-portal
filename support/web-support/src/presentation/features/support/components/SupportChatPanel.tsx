/**
 * SupportChatPanel — Support Console
 *
 * Renders the ticket message thread and lets the agent reply as SUPPORT.
 * Refreshes via ~5s silent polling (ADR-001; no WebSocket in MVP). Marks the
 * merchant's unread USER messages read on open and whenever new ones arrive.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import type { Message } from '../../../../domain/entities/message.entity'
import { SenderType } from '../../../../domain/entities/message.entity'
import { cn } from '../../../../shared/utils/cn'
import { formatDateTime } from '../utils/format'

const POLL_INTERVAL_MS = 5000

interface Props {
  ticketId: string
  messages: Message[]
  loading: boolean
  sending: boolean
  actionError?: string | null
  disabled?: boolean
  onLoadMessages: (ticketId: string, opts?: { silent?: boolean }) => void
  onSend: (content: string) => Promise<boolean>
  onMarkRead: () => void
}

function senderLabel(senderType: SenderType, t: (k: string) => string): string {
  switch (senderType) {
    case SenderType.SUPPORT:
      return t('support.chat.senderSupport')
    case SenderType.USER:
      return t('support.chat.senderUser')
    default:
      return t('support.chat.senderSystem')
  }
}

export function SupportChatPanel({
  ticketId,
  messages,
  loading,
  sending,
  actionError,
  disabled,
  onLoadMessages,
  onSend,
  onMarkRead,
}: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageCount = messages.length

  // Initial load + 5s polling.
  useEffect(() => {
    onLoadMessages(ticketId)
    const timer = setInterval(() => onLoadMessages(ticketId, { silent: true }), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  // Auto-scroll to newest + mark read whenever the thread changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    onMarkRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount])

  const handleSend = async () => {
    if (!draft.trim() || sending) return
    const ok = await onSend(draft)
    if (ok) setDraft('')
  }

  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 h-[540px]">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">{t('support.chat.title')}</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">{t('support.chat.empty')}</p>
        ) : (
          messages.map((m) => {
            const isSupport = m.senderType === SenderType.SUPPORT
            const isSystem = m.senderType === SenderType.SYSTEM
            return (
              <div
                key={m.messageId}
                className={cn('flex', isSupport ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2.5',
                    isSupport && 'bg-orange-600 text-white rounded-br-sm',
                    !isSupport && !isSystem && 'bg-gray-100 text-gray-900 rounded-bl-sm',
                    isSystem && 'bg-gray-50 text-gray-500 border border-dashed border-gray-300 text-xs italic',
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-2 mb-0.5 text-[11px]',
                      isSupport ? 'text-orange-100' : 'text-gray-400',
                    )}
                  >
                    <span className="font-medium">{senderLabel(m.senderType, t)}</span>
                    <span>·</span>
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  {m.attachments.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {m.attachments.map((a) => (
                        <li key={a.id}>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'text-xs underline break-all',
                              isSupport ? 'text-orange-100' : 'text-orange-600',
                            )}
                          >
                            {a.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 p-3">
        {actionError && <p className="text-xs text-red-600 mb-2">{actionError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={2}
            disabled={disabled || sending}
            placeholder={
              disabled ? t('support.chat.disabledPlaceholder') : t('support.chat.placeholder')
            }
            aria-label={t('support.chat.placeholder')}
            className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={disabled || sending || !draft.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('support.chat.send')}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{t('support.chat.send')}</span>
          </button>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">{t('support.chat.replyHint')}</p>
      </div>
    </div>
  )
}
