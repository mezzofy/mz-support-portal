/**
 * SendSupportMessageUseCase — reply as SUPPORT.
 * senderType is forced SUPPORT and senderId = ctx.agentId server-side.
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { Message } from '../../entities/message.entity'
import type {
  IMessageRepository,
  SendSupportMessageInput,
} from '../../repositories/message.repository.interface'

@injectable()
export class SendSupportMessageUseCase {
  constructor(private repository: IMessageRepository) {}

  async execute(input: SendSupportMessageInput): AsyncResult<Message> {
    return await this.repository.sendSupportMessage(input)
  }
}
