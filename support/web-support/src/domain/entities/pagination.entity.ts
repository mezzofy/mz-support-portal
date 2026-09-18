/**
 * Pagination & Filters — Support Console
 * Maps to the frozen SupportTicketFiltersInput + supportTickets(page, limit) args.
 * NOTE: the frozen SDL exposes no sort arguments — svc-support returns
 * newest-first (GSI2), so the console does not offer server-side sorting.
 */

export interface SupportTicketFilters {
  merchantId?: string
  status?: string
  type?: string
  priority?: string
  assigneeId?: string
  unassigned?: boolean
  search?: string
}

export interface SupportTicketQueryParams {
  page: number
  pageSize: number
  filters: SupportTicketFilters
}
