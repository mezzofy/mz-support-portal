/**
 * MessageRepositoryImpl — Support Console
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../core/types/common'
import { AppError } from '../../core/errors/app-error'
import type { Message } from '../../domain/entities/message.entity'
import type {
  IMessageRepository,
  SendSupportMessageInput,
} from '../../domain/repositories/message.repository.interface'
import type { SupportGraphQLDatasource } from '../datasources/support-graphql.datasource'
import { mapMessage } from '../mappers/support-ticket.mapper'

@injectable()
export class MessageRepositoryImpl implements IMessageRepository {
  constructor(private datasource: SupportGraphQLDatasource) {}

  async getMessages(ticketId: string): AsyncResult<Message[]> {
    try {
      const raw = await this.datasource.getMessages(ticketId)
      return { success: true, data: raw.map(mapMessage) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }

  async sendSupportMessage(input: SendSupportMessageInput): AsyncResult<Message> {
    try {
      const raw = await this.datasource.sendSupportMessage({
        ticketId: input.ticketId,
        content: input.content,
        attachments: input.attachments,
      })
      return { success: true, data: mapMessage(raw) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }

  async markMessagesAsRead(ticketId: string, userId: string): AsyncResult<string> {
    try {
      const message = await this.datasource.markMessagesAsRead(ticketId, userId)
      return { success: true, data: message }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }
}
