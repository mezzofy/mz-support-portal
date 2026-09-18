/**
 * GetSupportTicketsUseCase — cross-merchant queue.
 */
import { injectable } from 'inversify'
import type { AsyncResult, PaginatedResponse } from '../../../core/types/common'
import type { SupportTicket } from '../../entities/support-ticket.entity'
import type { SupportTicketQueryParams } from '../../entities/pagination.entity'
import type { ISupportTicketRepository } from '../../repositories/support-ticket.repository.interface'

@injectable()
export class GetSupportTicketsUseCase {
  constructor(private repository: ISupportTicketRepository) {}

  async execute(params: SupportTicketQueryParams): AsyncResult<PaginatedResponse<SupportTicket>> {
    return await this.repository.getSupportTickets(params)
  }
}
