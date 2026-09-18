/**
 * Shared test fixtures + DI helpers — Support Console tests.
 */
import { container, TYPES, resetContainer } from '../src/core/di/container'
import type {
  RawSupportTicket,
  RawMessage,
  RawPaginatedSupportTickets,
} from '../src/data/datasources/support-graphql.datasource'
import type { AsyncResult, PaginatedResponse } from '../src/core/types/common'
import type { SupportTicket } from '../src/domain/entities/support-ticket.entity'
import type { Message } from '../src/domain/entities/message.entity'

export function rawTicket(overrides: Partial<RawSupportTicket> = {}): RawSupportTicket {
  return {
    ticketId: 'TCK-1',
    merchantId: 'MER-1',
    merchantName: 'Acme Coffee',
    userId: 'USR-1',
    type: 'TECHNICAL',
    status: 'OPEN',
    priority: 'HIGH',
    subject: 'Cannot scan voucher',
    description: 'Scanner shows an error at redemption.',
    attachments: [],
    assigneeId: null,
    assigneeName: null,
    assignedTeam: null,
    assignedAt: null,
    createdAt: '2026-09-10T08:00:00Z',
    updatedAt: '2026-09-11T09:30:00Z',
    closedAt: null,
    ...overrides,
  }
}

export function rawMessage(overrides: Partial<RawMessage> = {}): RawMessage {
  return {
    messageId: 'MSG-1',
    ticketId: 'TCK-1',
    senderId: 'USR-1',
    senderType: 'USER',
    content: 'Any update on this?',
    attachments: [],
    isRead: false,
    createdAt: '2026-09-11T10:00:00Z',
    ...overrides,
  }
}

export function rawPage(
  tickets: RawSupportTicket[],
  overrides: Partial<RawPaginatedSupportTickets> = {},
): RawPaginatedSupportTickets {
  return {
    tickets,
    total: tickets.length,
    page: 1,
    limit: 20,
    ...overrides,
  }
}

/** Minimal use-case double: records the last params it was called with. */
export interface FakeListUseCase {
  execute: (params: unknown) => AsyncResult<PaginatedResponse<SupportTicket>>
  lastParams: unknown
}

export function fakeListUseCase(
  result: AsyncResult<PaginatedResponse<SupportTicket>>,
): FakeListUseCase {
  const uc: FakeListUseCase = {
    lastParams: undefined,
    execute: (params: unknown) => {
      uc.lastParams = params
      return result
    },
  }
  return uc
}

/** Bind an arbitrary constant value against a DI TYPES symbol for the SUT to resolve. */
export function bind<T>(symbol: symbol, value: T): void {
  if (container.isBound(symbol)) container.unbind(symbol)
  container.bind<T>(symbol).toConstantValue(value)
}

export { container, TYPES, resetContainer }

export type { AsyncResult, PaginatedResponse, SupportTicket, Message }
