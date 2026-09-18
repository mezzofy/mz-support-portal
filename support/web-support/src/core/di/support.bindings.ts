/**
 * Support Dependency Bindings — Support Console
 * Uses toDynamicValue() to avoid the emitDecoratorMetadata requirement with Vite/esbuild.
 */
import { Container } from 'inversify'
import { TYPES } from './container'
import { SupportGraphQLDatasource } from '../../data/datasources/support-graphql.datasource'
import { SupportTicketRepositoryImpl } from '../../data/repositories/support-ticket.repository.impl'
import { MessageRepositoryImpl } from '../../data/repositories/message.repository.impl'
import type { ISupportTicketRepository } from '../../domain/repositories/support-ticket.repository.interface'
import type { IMessageRepository } from '../../domain/repositories/message.repository.interface'
import { GetSupportTicketsUseCase } from '../../domain/usecases/ticket/get-support-tickets.usecase'
import { GetMyAssignedTicketsUseCase } from '../../domain/usecases/ticket/get-my-assigned.usecase'
import { GetSupportTicketUseCase } from '../../domain/usecases/ticket/get-support-ticket.usecase'
import { AssignTicketUseCase } from '../../domain/usecases/ticket/assign-ticket.usecase'
import { UpdateTicketStatusUseCase } from '../../domain/usecases/ticket/update-ticket-status.usecase'
import { GetMessagesUseCase } from '../../domain/usecases/message/get-messages.usecase'
import { SendSupportMessageUseCase } from '../../domain/usecases/message/send-support-message.usecase'
import { MarkMessagesAsReadUseCase } from '../../domain/usecases/message/mark-messages-read.usecase'

export function registerSupportDependencies(container: Container): void {
  // Datasource
  container
    .bind<SupportGraphQLDatasource>(TYPES.SupportGraphQLDatasource)
    .to(SupportGraphQLDatasource)
    .inSingletonScope()

  // Repositories
  container
    .bind(TYPES.SupportTicketRepository)
    .toDynamicValue((context) => {
      const ds = context.container.get<SupportGraphQLDatasource>(TYPES.SupportGraphQLDatasource)
      return new SupportTicketRepositoryImpl(ds)
    })
    .inSingletonScope()

  container
    .bind(TYPES.MessageRepository)
    .toDynamicValue((context) => {
      const ds = context.container.get<SupportGraphQLDatasource>(TYPES.SupportGraphQLDatasource)
      return new MessageRepositoryImpl(ds)
    })
    .inSingletonScope()

  // Ticket use cases
  container
    .bind(TYPES.GetSupportTicketsUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<ISupportTicketRepository>(TYPES.SupportTicketRepository)
      return new GetSupportTicketsUseCase(repo)
    })
    .inSingletonScope()

  container
    .bind(TYPES.GetMyAssignedTicketsUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<ISupportTicketRepository>(TYPES.SupportTicketRepository)
      return new GetMyAssignedTicketsUseCase(repo)
    })
    .inSingletonScope()

  container
    .bind(TYPES.GetSupportTicketUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<ISupportTicketRepository>(TYPES.SupportTicketRepository)
      return new GetSupportTicketUseCase(repo)
    })
    .inSingletonScope()

  container
    .bind(TYPES.AssignTicketUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<ISupportTicketRepository>(TYPES.SupportTicketRepository)
      return new AssignTicketUseCase(repo)
    })
    .inSingletonScope()

  container
    .bind(TYPES.UpdateTicketStatusUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<ISupportTicketRepository>(TYPES.SupportTicketRepository)
      return new UpdateTicketStatusUseCase(repo)
    })
    .inSingletonScope()

  // Message use cases
  container
    .bind(TYPES.GetMessagesUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<IMessageRepository>(TYPES.MessageRepository)
      return new GetMessagesUseCase(repo)
    })
    .inSingletonScope()

  container
    .bind(TYPES.SendSupportMessageUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<IMessageRepository>(TYPES.MessageRepository)
      return new SendSupportMessageUseCase(repo)
    })
    .inSingletonScope()

  container
    .bind(TYPES.MarkMessagesAsReadUseCase)
    .toDynamicValue((context) => {
      const repo = context.container.get<IMessageRepository>(TYPES.MessageRepository)
      return new MarkMessagesAsReadUseCase(repo)
    })
    .inSingletonScope()
}
