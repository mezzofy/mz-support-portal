/**
 * GetMyAssignedTicketsUseCase — tickets assigned to the signed-in agent.
 * "my" is resolved server-side from the STAFF token (ctx.agentId).
 */
import { injectable } from 'inversify'
import type { AsyncResult, PaginatedResponse } from '../../../core/types/common'
import type { SupportTicket } from '../../entities/support-ticket.entity'
import type { SupportTicketQueryParams } from '../../entities/pagination.entity'
import type { ISupportTicketRepository } from '../../repositories/support-ticket.repository.interface'

@injectable()
export class GetMyAssignedTicketsUseCase {
  constructor(private repository: ISupportTicketRepository) {}

  async execute(params: SupportTicketQueryParams): AsyncResult<PaginatedResponse<SupportTicket>> {
    return await this.repository.getMyAssignedTickets(params)
  }
}
