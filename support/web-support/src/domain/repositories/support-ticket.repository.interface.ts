/**
 * ISupportTicketRepository — Support Console
 */
import type { AsyncResult, PaginatedResponse } from '../../core/types/common'
import type { SupportTicket } from '../entities/support-ticket.entity'
import type { SupportTicketQueryParams } from '../entities/pagination.entity'

export interface AssignTicketInput {
  ticketId: string
  assigneeId: string
  assigneeName?: string
  assignedTeam?: string
}

export interface ISupportTicketRepository {
  getSupportTickets(params: SupportTicketQueryParams): AsyncResult<PaginatedResponse<SupportTicket>>
  getMyAssignedTickets(params: SupportTicketQueryParams): AsyncResult<PaginatedResponse<SupportTicket>>
  getSupportTicket(ticketId: string): AsyncResult<SupportTicket>
  assignTicket(input: AssignTicketInput): AsyncResult<SupportTicket>
  updateTicketStatus(ticketId: string, status: string): AsyncResult<SupportTicket>
}
