/**
 * useTicketDetailViewModel — drives one ticket: load, assign, change status,
 * send SUPPORT reply (optimistic append), and mark the merchant's USER
 * messages read. Use-cases are stubbed via the DI container.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useTicketDetailViewModel } from '../../src/presentation/features/support/viewmodels/useTicketDetailViewModel'
import { mapSupportTicket, mapMessage } from '../../src/data/mappers/support-ticket.mapper'
import { SenderType } from '../../src/domain/entities/message.entity'
import { AppError } from '../../src/core/errors/app-error'
import { TYPES, bind, resetContainer, rawTicket, rawMessage } from '../helpers'

interface FakeUC<R = unknown> {
  calls: unknown[][]
  result: unknown
  execute: (...args: unknown[]) => Promise<R>
}
function fakeUC(result: unknown): FakeUC {
  const uc: FakeUC = {
    calls: [],
    result,
    execute: (...args: unknown[]) => {
      uc.calls.push(args)
      return Promise.resolve(uc.result)
    },
  }
  return uc
}
const okResult = <T>(data: T) => ({ success: true as const, data })
const errResult = (message: string) => ({
  success: false as const,
  error: new AppError('SERVER_ERROR' as never, message),
})

const ticket = mapSupportTicket(rawTicket({ status: 'IN_PROGRESS', userId: 'USR-1' }))

beforeEach(() => useTicketDetailViewModel.getState().reset())
afterEach(() => resetContainer())

describe('loadTicket', () => {
  it('sets the ticket on success', async () => {
    bind(TYPES.GetSupportTicketUseCase, fakeUC(okResult(ticket)))
    await useTicketDetailViewModel.getState().loadTicket('TCK-1')
    expect(useTicketDetailViewModel.getState().ticket?.ticketId).toBe('TCK-1')
    expect(useTicketDetailViewModel.getState().loadingTicket).toBe(false)
  })

  it('sets error on a failed Result', async () => {
    bind(TYPES.GetSupportTicketUseCase, fakeUC(errResult('not found')))
    await useTicketDetailViewModel.getState().loadTicket('TCK-404')
    expect(useTicketDetailViewModel.getState().error).toBe('not found')
    expect(useTicketDetailViewModel.getState().ticket).toBeNull()
  })
})

describe('loadMessages', () => {
  it('loads messages and clears the loading flag', async () => {
    const msgs = [mapMessage(rawMessage())]
    bind(TYPES.GetMessagesUseCase, fakeUC(okResult(msgs)))
    await useTicketDetailViewModel.getState().loadMessages('TCK-1')
    expect(useTicketDetailViewModel.getState().messages).toHaveLength(1)
    expect(useTicketDetailViewModel.getState().loadingMessages).toBe(false)
  })

  it('silent reload does not raise loadingMessages', async () => {
    const uc = fakeUC(okResult([mapMessage(rawMessage())]))
    bind(TYPES.GetMessagesUseCase, uc)
    await useTicketDetailViewModel.getState().loadMessages('TCK-1', { silent: true })
    expect(useTicketDetailViewModel.getState().loadingMessages).toBe(false)
    expect(useTicketDetailViewModel.getState().messages).toHaveLength(1)
  })
})

describe('sendReply', () => {
  it('returns false and does not call the use-case with empty content', async () => {
    const uc = fakeUC(okResult(mapMessage(rawMessage())))
    bind(TYPES.SendSupportMessageUseCase, uc)
    useTicketDetailViewModel.setState({ ticket })
    const ok = await useTicketDetailViewModel.getState().sendReply('   ')
    expect(ok).toBe(false)
    expect(uc.calls).toHaveLength(0)
  })

  it('returns false when no ticket is loaded', async () => {
    const ok = await useTicketDetailViewModel.getState().sendReply('hello')
    expect(ok).toBe(false)
  })

  it('optimistically appends the SUPPORT reply on success', async () => {
    const reply = mapMessage(rawMessage({ messageId: 'MSG-NEW', senderType: 'SUPPORT', content: 'On it' }))
    const uc = fakeUC(okResult(reply))
    bind(TYPES.SendSupportMessageUseCase, uc)
    useTicketDetailViewModel.setState({ ticket, messages: [] })

    const ok = await useTicketDetailViewModel.getState().sendReply('  On it  ')
    expect(ok).toBe(true)
    expect(uc.calls[0][0]).toEqual({ ticketId: 'TCK-1', content: 'On it' }) // trimmed
    const msgs = useTicketDetailViewModel.getState().messages
    expect(msgs.at(-1)?.messageId).toBe('MSG-NEW')
    expect(useTicketDetailViewModel.getState().sending).toBe(false)
  })

  it('sets actionError and returns false on failure', async () => {
    bind(TYPES.SendSupportMessageUseCase, fakeUC(errResult('send failed')))
    useTicketDetailViewModel.setState({ ticket, messages: [] })
    const ok = await useTicketDetailViewModel.getState().sendReply('hi')
    expect(ok).toBe(false)
    expect(useTicketDetailViewModel.getState().actionError).toBe('send failed')
  })
})

describe('assign', () => {
  it('updates the ticket on success (may reflect auto-advance)', async () => {
    const advanced = mapSupportTicket(rawTicket({ status: 'IN_PROGRESS', assigneeId: 'AG-7' }))
    const uc = fakeUC(okResult(advanced))
    bind(TYPES.AssignTicketUseCase, uc)
    const ok = await useTicketDetailViewModel.getState().assign({ ticketId: 'TCK-1', assigneeId: 'AG-7' })
    expect(ok).toBe(true)
    expect(useTicketDetailViewModel.getState().ticket?.assigneeId).toBe('AG-7')
    expect(uc.calls[0][0]).toEqual({ ticketId: 'TCK-1', assigneeId: 'AG-7' })
  })

  it('sets actionError on failure', async () => {
    bind(TYPES.AssignTicketUseCase, fakeUC(errResult('cannot assign')))
    const ok = await useTicketDetailViewModel.getState().assign({ ticketId: 'TCK-1', assigneeId: 'AG-7' })
    expect(ok).toBe(false)
    expect(useTicketDetailViewModel.getState().actionError).toBe('cannot assign')
  })
})

describe('changeStatus', () => {
  it('returns false when no ticket is loaded', async () => {
    const ok = await useTicketDetailViewModel.getState().changeStatus('RESOLVED')
    expect(ok).toBe(false)
  })

  it('updates the ticket status on success', async () => {
    const resolved = mapSupportTicket(rawTicket({ status: 'RESOLVED' }))
    const uc = fakeUC(okResult(resolved))
    bind(TYPES.UpdateTicketStatusUseCase, uc)
    useTicketDetailViewModel.setState({ ticket })
    const ok = await useTicketDetailViewModel.getState().changeStatus('RESOLVED')
    expect(ok).toBe(true)
    expect(useTicketDetailViewModel.getState().ticket?.status).toBe('RESOLVED')
    expect(uc.calls[0]).toEqual(['TCK-1', 'RESOLVED'])
  })

  it('surfaces an invalid-transition error message', async () => {
    bind(TYPES.UpdateTicketStatusUseCase, fakeUC(errResult('Invalid transition')))
    useTicketDetailViewModel.setState({ ticket })
    const ok = await useTicketDetailViewModel.getState().changeStatus('CLOSED')
    expect(ok).toBe(false)
    expect(useTicketDetailViewModel.getState().actionError).toBe('Invalid transition')
  })
})

describe('markRead', () => {
  it('does nothing when there is no unread USER message', async () => {
    const uc = fakeUC(okResult('ok'))
    bind(TYPES.MarkMessagesAsReadUseCase, uc)
    useTicketDetailViewModel.setState({
      ticket,
      messages: [mapMessage(rawMessage({ senderType: 'SUPPORT', isRead: false }))],
    })
    await useTicketDetailViewModel.getState().markRead()
    expect(uc.calls).toHaveLength(0)
  })

  it('marks USER messages read when at least one is unread', async () => {
    const uc = fakeUC(okResult('ok'))
    bind(TYPES.MarkMessagesAsReadUseCase, uc)
    useTicketDetailViewModel.setState({
      ticket,
      messages: [
        mapMessage(rawMessage({ messageId: 'M-U', senderType: 'USER', isRead: false })),
        mapMessage(rawMessage({ messageId: 'M-S', senderType: 'SUPPORT', isRead: true })),
      ],
    })
    await useTicketDetailViewModel.getState().markRead()
    expect(uc.calls[0]).toEqual(['TCK-1', 'USR-1']) // ticketId, ticket.userId
    const msgs = useTicketDetailViewModel.getState().messages
    expect(msgs.find((m) => m.messageId === 'M-U')?.isRead).toBe(true)
    expect(msgs.find((m) => m.senderType === SenderType.SUPPORT)?.isRead).toBe(true)
  })
})

describe('reset / clearActionError', () => {
  it('clearActionError nulls the action error', () => {
    useTicketDetailViewModel.setState({ actionError: 'x' })
    useTicketDetailViewModel.getState().clearActionError()
    expect(useTicketDetailViewModel.getState().actionError).toBeNull()
  })

  it('reset restores initial state', () => {
    useTicketDetailViewModel.setState({ ticket, messages: [mapMessage(rawMessage())], error: 'e' })
    useTicketDetailViewModel.getState().reset()
    const s = useTicketDetailViewModel.getState()
    expect(s.ticket).toBeNull()
    expect(s.messages).toEqual([])
    expect(s.error).toBeNull()
  })
})
