/**
 * useTicketDetailViewModel — Support Console
 *
 * Drives SupportTicketDetailPage: loads one ticket + its message thread,
 * assigns agents, moves status along STATUS_TRANSITIONS, sends SUPPORT replies,
 * and marks the merchant's messages read. Chat is refreshed by ~5s polling
 * (ADR-001; MVP has no WebSocket).
 */
import { create } from 'zustand'
import { resolve, TYPES } from '../../../../core/di/container'
import type { SupportTicket } from '../../../../domain/entities/support-ticket.entity'
import type { Message } from '../../../../domain/entities/message.entity'
import { SenderType } from '../../../../domain/entities/message.entity'
import type { GetSupportTicketUseCase } from '../../../../domain/usecases/ticket/get-support-ticket.usecase'
import type { AssignTicketUseCase } from '../../../../domain/usecases/ticket/assign-ticket.usecase'
import type { UpdateTicketStatusUseCase } from '../../../../domain/usecases/ticket/update-ticket-status.usecase'
import type { GetMessagesUseCase } from '../../../../domain/usecases/message/get-messages.usecase'
import type { SendSupportMessageUseCase } from '../../../../domain/usecases/message/send-support-message.usecase'
import type { MarkMessagesAsReadUseCase } from '../../../../domain/usecases/message/mark-messages-read.usecase'
import type { AssignTicketInput } from '../../../../domain/repositories/support-ticket.repository.interface'

interface TicketDetailState {
  ticket: SupportTicket | null
  messages: Message[]
  loadingTicket: boolean
  loadingMessages: boolean
  sending: boolean
  actionPending: boolean
  error: string | null
  actionError: string | null

  loadTicket: (ticketId: string) => Promise<void>
  loadMessages: (ticketId: string, opts?: { silent?: boolean }) => Promise<void>
  sendReply: (content: string) => Promise<boolean>
  assign: (input: AssignTicketInput) => Promise<boolean>
  changeStatus: (status: string) => Promise<boolean>
  markRead: () => Promise<void>
  clearActionError: () => void
  reset: () => void
}

export const useTicketDetailViewModel = create<TicketDetailState>((set, get) => ({
  ticket: null,
  messages: [],
  loadingTicket: false,
  loadingMessages: false,
  sending: false,
  actionPending: false,
  error: null,
  actionError: null,

  loadTicket: async (ticketId) => {
    set({ loadingTicket: true, error: null })
    try {
      const useCase = resolve<GetSupportTicketUseCase>(TYPES.GetSupportTicketUseCase)
      const result = await useCase.execute(ticketId)
      if (result.success) {
        set({ ticket: result.data, loadingTicket: false })
      } else {
        set({ error: result.error.message, loadingTicket: false })
      }
    } catch {
      set({ error: 'Failed to load ticket', loadingTicket: false })
    }
  },

  loadMessages: async (ticketId, opts) => {
    if (!opts?.silent) set({ loadingMessages: true })
    try {
      const useCase = resolve<GetMessagesUseCase>(TYPES.GetMessagesUseCase)
      const result = await useCase.execute(ticketId)
      if (result.success) {
        set({ messages: result.data, loadingMessages: false })
      } else {
        set({ loadingMessages: false })
        if (!opts?.silent) set({ error: result.error.message })
      }
    } catch {
      set({ loadingMessages: false })
    }
  },

  sendReply: async (content) => {
    const ticket = get().ticket
    if (!ticket || !content.trim()) return false
    set({ sending: true, actionError: null })
    try {
      const useCase = resolve<SendSupportMessageUseCase>(TYPES.SendSupportMessageUseCase)
      const result = await useCase.execute({ ticketId: ticket.ticketId, content: content.trim() })
      if (result.success) {
        // Optimistically append, then reconcile with a silent poll.
        set((s) => ({ messages: [...s.messages, result.data], sending: false }))
        return true
      }
      set({ actionError: result.error.message, sending: false })
      return false
    } catch {
      set({ actionError: 'Failed to send message', sending: false })
      return false
    }
  },

  assign: async (input) => {
    set({ actionPending: true, actionError: null })
    try {
      const useCase = resolve<AssignTicketUseCase>(TYPES.AssignTicketUseCase)
      const result = await useCase.execute(input)
      if (result.success) {
        set({ ticket: result.data, actionPending: false })
        return true
      }
      set({ actionError: result.error.message, actionPending: false })
      return false
    } catch {
      set({ actionError: 'Failed to assign ticket', actionPending: false })
      return false
    }
  },

  changeStatus: async (status) => {
    const ticket = get().ticket
    if (!ticket) return false
    set({ actionPending: true, actionError: null })
    try {
      const useCase = resolve<UpdateTicketStatusUseCase>(TYPES.UpdateTicketStatusUseCase)
      const result = await useCase.execute(ticket.ticketId, status)
      if (result.success) {
        set({ ticket: result.data, actionPending: false })
        return true
      }
      set({ actionError: result.error.message, actionPending: false })
      return false
    } catch {
      set({ actionError: 'Failed to update status', actionPending: false })
      return false
    }
  },

  markRead: async () => {
    const ticket = get().ticket
    if (!ticket) return
    // Only mark when there is at least one unread USER-sent message.
    const hasUnreadUser = get().messages.some(
      (m) => m.senderType === SenderType.USER && !m.isRead,
    )
    if (!hasUnreadUser) return
    try {
      const useCase = resolve<MarkMessagesAsReadUseCase>(TYPES.MarkMessagesAsReadUseCase)
      const result = await useCase.execute(ticket.ticketId, ticket.userId)
      if (result.success) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.senderType === SenderType.USER ? { ...m, isRead: true } : m,
          ),
        }))
      }
    } catch {
      /* non-fatal */
    }
  },

  clearActionError: () => set({ actionError: null }),

  reset: () =>
    set({
      ticket: null,
      messages: [],
      loadingTicket: false,
      loadingMessages: false,
      sending: false,
      actionPending: false,
      error: null,
      actionError: null,
    }),
}))
