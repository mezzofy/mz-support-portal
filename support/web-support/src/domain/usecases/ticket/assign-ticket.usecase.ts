/**
 * AssignTicketUseCase — assign a ticket to an agent (may auto-advance OPEN->IN_PROGRESS).
 */
import { injectable } from 'inversify'
import type { AsyncResult } from '../../../core/types/common'
import type { SupportTicket } from '../../entities/support-ticket.entity'
import type {
  ISupportTicketRepository,
  AssignTicketInput,
} from '../../repositories/support-ticket.repository.interface'

@injectable()
export class AssignTicketUseCase {
  constructor(private repository: ISupportTicketRepository) {}

  async execute(input: AssignTicketInput): AsyncResult<SupportTicket> {
    return await this.repository.assignTicket(input)
  }
}
