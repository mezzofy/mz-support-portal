/**
 * GetMessagesUseCase — full message thread for a ticket.
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { Message } from '../../entities/message.entity'
import type { IMessageRepository } from '../../repositories/message.repository.interface'

@injectable()
export class GetMessagesUseCase {
  constructor(private repository: IMessageRepository) {}

  async execute(ticketId: string): AsyncResult<Message[]> {
    return await this.repository.getMessages(ticketId)
  }
}
