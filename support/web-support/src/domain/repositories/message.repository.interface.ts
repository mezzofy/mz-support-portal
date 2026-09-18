/**
 * IMessageRepository — Support Console
 */
import type { AsyncResult } from '../../core/types/common'
import type { Message } from '../entities/message.entity'
import type { Attachment } from '../entities/support-ticket.entity'

export interface SendSupportMessageInput {
  ticketId: string
  content: string
  attachments?: Attachment[]
}

export interface IMessageRepository {
  getMessages(ticketId: string): AsyncResult<Message[]>
  sendSupportMessage(input: SendSupportMessageInput): AsyncResult<Message>
  markMessagesAsRead(ticketId: string, userId: string): AsyncResult<string>
}
