/**
 * useMyAssignedViewModel — tickets assigned to the signed-in agent
 * (GetMyAssignedTicketsUseCase; "my" is resolved server-side).
 */
import { TYPES } from '../../../../core/di/container'
import { createTicketListViewModel } from './createTicketListViewModel'

export const useMyAssignedViewModel = createTicketListViewModel(
  TYPES.GetMyAssignedTicketsUseCase,
  false,
)
