/**
 * UpdateTicketStatusUseCase — move a ticket along the STATUS_TRANSITIONS machine.
 * The backend re-validates the transition; the UI only offers allowed targets.
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { SupportTicket } from '../../entities/support-ticket.entity'
import type { ISupportTicketRepository } from '../../repositories/support-ticket.repository.interface'

@injectable()
export class UpdateTicketStatusUseCase {
  constructor(private repository: ISupportTicketRepository) {}

  async execute(ticketId: string, status: string): AsyncResult<SupportTicket> {
    return await this.repository.updateTicketStatus(ticketId, status)
  }
}
