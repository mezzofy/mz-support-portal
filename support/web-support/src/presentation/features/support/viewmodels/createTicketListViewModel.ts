/**
 * createTicketListViewModel — Support Console
 *
 * Factory for the Queue and MyAssigned list stores. Both share identical
 * list/filter/pagination behaviour; they differ only in which use-case they
 * resolve (GetSupportTicketsUseCase vs GetMyAssignedTicketsUseCase). Forked
 * from the admin useTicketListViewModel, extended with support filters
 * (merchant / assignee / unassigned) and without server-side sort (the frozen
 * SDL returns newest-first with no sort argument).
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { resolve } from '../../../../core/di/container'
import type { SupportTicket } from '../../../../domain/entities/support-ticket.entity'
import type { SupportTicketFilters } from '../../../../domain/entities/pagination.entity'
import type { GetSupportTicketsUseCase } from '../../../../domain/usecases/ticket/get-support-tickets.usecase'
import type { GetMyAssignedTicketsUseCase } from '../../../../domain/usecases/ticket/get-my-assigned.usecase'

type ListUseCase = GetSupportTicketsUseCase | GetMyAssignedTicketsUseCase

export interface TicketListState {
  tickets: SupportTicket[]
  loading: boolean
  error: string | null
  currentPage: number
  pageSize: number
  totalPages: number
  totalItems: number
  // filters
  searchQuery: string
  statusFilter: string
  typeFilter: string
  priorityFilter: string
  merchantFilter: string
  assigneeFilter: string
  unassignedOnly: boolean
  // actions
  loadTickets: () => Promise<void>
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setSearchQuery: (q: string) => void
  setStatusFilter: (s: string) => void
  setTypeFilter: (t: string) => void
  setPriorityFilter: (p: string) => void
  setMerchantFilter: (m: string) => void
  setAssigneeFilter: (a: string) => void
  setUnassignedOnly: (v: boolean) => void
  resetFilters: () => void
  hasActiveFilters: () => boolean
}

/**
 * @param useCaseType DI symbol resolving to a use-case with
 *        `execute(params) -> AsyncResult<PaginatedResponse<SupportTicket>>`.
 * @param includeAssigneeFilters whether this list exposes assignee/unassigned
 *        controls (Queue = true; MyAssigned = false, it is already self-scoped).
 */
export function createTicketListViewModel(
  useCaseType: symbol,
  includeAssigneeFilters: boolean,
): UseBoundStore<StoreApi<TicketListState>> {
  return create<TicketListState>((set, get) => ({
    tickets: [],
    loading: false,
    error: null,
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
    searchQuery: '',
    statusFilter: '',
    typeFilter: '',
    priorityFilter: '',
    merchantFilter: '',
    assigneeFilter: '',
    unassignedOnly: false,

    loadTickets: async () => {
      const state = get()
      set({ loading: true, error: null })

      const filters: SupportTicketFilters = {
        search: state.searchQuery || undefined,
        status: state.statusFilter || undefined,
        type: state.typeFilter || undefined,
        priority: state.priorityFilter || undefined,
        merchantId: state.merchantFilter || undefined,
      }
      if (includeAssigneeFilters) {
        filters.assigneeId = state.assigneeFilter || undefined
        filters.unassigned = state.unassignedOnly || undefined
      }

      try {
        const useCase = resolve<ListUseCase>(useCaseType)
        const result = await useCase.execute({
          page: state.currentPage,
          pageSize: state.pageSize,
          filters,
        })
        if (result.success) {
          set({
            tickets: result.data.data,
            totalItems: result.data.total,
            totalPages: Math.max(1, Math.ceil(result.data.total / state.pageSize)),
            currentPage: result.data.page,
            loading: false,
          })
        } else {
          set({ error: result.error.message, loading: false })
        }
      } catch {
        set({ error: 'Failed to load tickets', loading: false })
      }
    },

    setCurrentPage: (page) => {
      set({ currentPage: page })
      get().loadTickets()
    },
    setPageSize: (size) => {
      set({ pageSize: size, currentPage: 1 })
      get().loadTickets()
    },
    setSearchQuery: (q) => {
      set({ searchQuery: q, currentPage: 1 })
      get().loadTickets()
    },
    setStatusFilter: (s) => {
      set({ statusFilter: s, currentPage: 1 })
      get().loadTickets()
    },
    setTypeFilter: (t) => {
      set({ typeFilter: t, currentPage: 1 })
      get().loadTickets()
    },
    setPriorityFilter: (p) => {
      set({ priorityFilter: p, currentPage: 1 })
      get().loadTickets()
    },
    setMerchantFilter: (m) => {
      set({ merchantFilter: m, currentPage: 1 })
      get().loadTickets()
    },
    setAssigneeFilter: (a) => {
      set({ assigneeFilter: a, unassignedOnly: false, currentPage: 1 })
      get().loadTickets()
    },
    setUnassignedOnly: (v) => {
      set({ unassignedOnly: v, assigneeFilter: v ? '' : get().assigneeFilter, currentPage: 1 })
      get().loadTickets()
    },
    resetFilters: () => {
      set({
        searchQuery: '',
        statusFilter: '',
        typeFilter: '',
        priorityFilter: '',
        merchantFilter: '',
        assigneeFilter: '',
        unassignedOnly: false,
        currentPage: 1,
      })
      get().loadTickets()
    },
    hasActiveFilters: () => {
      const s = get()
      return Boolean(
        s.searchQuery ||
          s.statusFilter ||
          s.typeFilter ||
          s.priorityFilter ||
          s.merchantFilter ||
          s.assigneeFilter ||
          s.unassignedOnly,
      )
    },
  }))
}
