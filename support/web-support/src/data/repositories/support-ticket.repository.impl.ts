/**
 * SupportTicketRepositoryImpl — Support Console
 */
import { injectable } from 'inversify'
import type { AsyncResult, PaginatedResponse } from '../../core/types/common'
import { AppError } from '../../core/errors/app-error'
import type { SupportTicket } from '../../domain/entities/support-ticket.entity'
import type { SupportTicketQueryParams } from '../../domain/entities/pagination.entity'
import type {
  ISupportTicketRepository,
  AssignTicketInput,
} from '../../domain/repositories/support-ticket.repository.interface'
import type {
  SupportGraphQLDatasource,
  RawPaginatedSupportTickets,
  SupportTicketFiltersInput,
} from '../datasources/support-graphql.datasource'
import { mapSupportTicket } from '../mappers/support-ticket.mapper'

/** Strip empty/undefined filter fields so the wire input stays minimal. */
function toFiltersInput(params: SupportTicketQueryParams): SupportTicketFiltersInput {
  const f = params.filters
  const out: SupportTicketFiltersInput = {}
  if (f.merchantId) out.merchantId = f.merchantId
  if (f.status) out.status = f.status
  if (f.type) out.type = f.type
  if (f.priority) out.priority = f.priority
  if (f.assigneeId) out.assigneeId = f.assigneeId
  if (f.unassigned) out.unassigned = true
  if (f.search) out.search = f.search
  return out
}

function toPaginated(raw: RawPaginatedSupportTickets): PaginatedResponse<SupportTicket> {
  const pageSize = raw.limit || 20
  return {
    data: (raw.tickets || []).map(mapSupportTicket),
    total: raw.total,
    page: raw.page,
    pageSize,
    hasMore: raw.page * pageSize < raw.total,
  }
}

@injectable()
export class SupportTicketRepositoryImpl implements ISupportTicketRepository {
  constructor(private datasource: SupportGraphQLDatasource) {}

  async getSupportTickets(
    params: SupportTicketQueryParams,
  ): AsyncResult<PaginatedResponse<SupportTicket>> {
    try {
      const raw = await this.datasource.getSupportTickets(
        params.page,
        params.pageSize,
        toFiltersInput(params),
      )
      return { success: true, data: toPaginated(raw) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }

  async getMyAssignedTickets(
    params: SupportTicketQueryParams,
  ): AsyncResult<PaginatedResponse<SupportTicket>> {
    try {
      const raw = await this.datasource.getMyAssignedTickets(
        params.page,
        params.pageSize,
        toFiltersInput(params),
      )
      return { success: true, data: toPaginated(raw) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }

  async getSupportTicket(ticketId: string): AsyncResult<SupportTicket> {
    try {
      const raw = await this.datasource.getSupportTicket(ticketId)
      return { success: true, data: mapSupportTicket(raw) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }

  async assignTicket(input: AssignTicketInput): AsyncResult<SupportTicket> {
    try {
      const raw = await this.datasource.assignTicket({
        ticketId: input.ticketId,
        assigneeId: input.assigneeId,
        assigneeName: input.assigneeName,
        assignedTeam: input.assignedTeam,
      })
      return { success: true, data: mapSupportTicket(raw) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }

  async updateTicketStatus(ticketId: string, status: string): AsyncResult<SupportTicket> {
    try {
      const raw = await this.datasource.updateTicketStatus(ticketId, status)
      return { success: true, data: mapSupportTicket(raw) }
    } catch (error) {
      return { success: false, error: AppError.unknown(error) }
    }
  }
}
