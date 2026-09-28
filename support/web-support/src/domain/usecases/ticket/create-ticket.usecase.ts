/**
 * CreateTicketUseCase — staff creates a ticket on behalf of a merchant (Option C intake).
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { SupportTicket } from '../../entities/support-ticket.entity'
import type {
  ISupportTicketRepository,
  CreateSupportTicketInput,
} from '../../repositories/support-ticket.repository.interface'

@injectable()
export class CreateTicketUseCase {
  constructor(private repository: ISupportTicketRepository) {}

  async execute(input: CreateSupportTicketInput): AsyncResult<SupportTicket> {
    return await this.repository.createTicket(input)
  }
}
