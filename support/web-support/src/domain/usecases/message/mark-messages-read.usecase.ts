/**
 * MarkMessagesAsReadUseCase — mark the merchant/USER-sender messages read
 * when the agent opens the thread.
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { IMessageRepository } from '../../repositories/message.repository.interface'

@injectable()
export class MarkMessagesAsReadUseCase {
  constructor(private repository: IMessageRepository) {}

  async execute(ticketId: string, userId: string): AsyncResult<string> {
    return await this.repository.markMessagesAsRead(ticketId, userId)
  }
}
