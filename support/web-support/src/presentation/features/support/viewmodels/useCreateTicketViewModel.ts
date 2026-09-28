/**
 * useCreateTicketViewModel — one-shot create action for the "New ticket" dialog.
 * Resolves CreateTicketUseCase from the DI container; exposes pending/error state.
 */
import { useState, useCallback } from 'react'
import { resolve, TYPES } from '../../../../core/di/container'
import type { CreateTicketUseCase } from '../../../../domain/usecases/ticket/create-ticket.usecase'
import type { CreateSupportTicketInput } from '../../../../domain/repositories/support-ticket.repository.interface'
import type { SupportTicket } from '../../../../domain/entities/support-ticket.entity'

export function useCreateTicketViewModel() {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTicket = useCallback(
    async (input: CreateSupportTicketInput): Promise<SupportTicket | null> => {
      setCreating(true)
      setError(null)
      try {
        const useCase = resolve<CreateTicketUseCase>(TYPES.CreateTicketUseCase)
        const result = await useCase.execute(input)
        if (result.success) {
          setCreating(false)
          return result.data
        }
        setError(result.error.message)
        setCreating(false)
        return null
      } catch {
        setError('Failed to create ticket')
        setCreating(false)
        return null
      }
    },
    [],
  )

  const reset = useCallback(() => setError(null), [])

  return { createTicket, creating, error, reset }
}
