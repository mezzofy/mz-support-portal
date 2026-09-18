/**
 * GetSupportTicketUseCase — single ticket by id.
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { SupportTicket } from '../../entities/support-ticket.entity'
import type { ISupportTicketRepository } from '../../repositories/support-ticket.repository.interface'

@injectable()
export class GetSupportTicketUseCase {
  constructor(private repository: ISupportTicketRepository) {}

  async execute(ticketId: string): AsyncResult<SupportTicket> {
    return await this.repository.getSupportTicket(ticketId)
  }
}
