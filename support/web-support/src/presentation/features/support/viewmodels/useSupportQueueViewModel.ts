/**
 * useSupportQueueViewModel — all-merchant queue (GetSupportTicketsUseCase).
 */
import { TYPES } from '../../../../core/di/container'
import { createTicketListViewModel } from './createTicketListViewModel'

export const useSupportQueueViewModel = createTicketListViewModel(
  TYPES.GetSupportTicketsUseCase,
  true,
)
