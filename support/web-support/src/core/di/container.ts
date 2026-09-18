/**
 * Dependency Injection Container — Support Console
 */
import { Container } from 'inversify'

export const TYPES = {
  // Datasource
  SupportGraphQLDatasource: Symbol.for('SupportGraphQLDatasource'),
  // Repositories
  SupportTicketRepository: Symbol.for('SupportTicketRepository'),
  MessageRepository: Symbol.for('MessageRepository'),
  // Ticket use cases
  GetSupportTicketsUseCase: Symbol.for('GetSupportTicketsUseCase'),
  GetMyAssignedTicketsUseCase: Symbol.for('GetMyAssignedTicketsUseCase'),
  GetSupportTicketUseCase: Symbol.for('GetSupportTicketUseCase'),
  AssignTicketUseCase: Symbol.for('AssignTicketUseCase'),
  UpdateTicketStatusUseCase: Symbol.for('UpdateTicketStatusUseCase'),
  // Message use cases
  GetMessagesUseCase: Symbol.for('GetMessagesUseCase'),
  SendSupportMessageUseCase: Symbol.for('SendSupportMessageUseCase'),
  MarkMessagesAsReadUseCase: Symbol.for('MarkMessagesAsReadUseCase'),
} as const

export const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: false,
})

export function initializeContainer(): Container {
  return container
}

export function resolve<T>(serviceIdentifier: symbol): T {
  return container.get<T>(serviceIdentifier)
}

export function has(serviceIdentifier: symbol): boolean {
  return container.isBound(serviceIdentifier)
}

export function resetContainer(): void {
  container.unbindAll()
}
