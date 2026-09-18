/**
 * createTicketListViewModel (Zustand) — filter/pagination/error behaviour,
 * plus the queue-vs-myAssigned wiring (assignee/unassigned filters are only
 * emitted by the queue store; myAssigned is self-scoped server-side).
 *
 * The repository layer is stubbed by binding a fake use-case into the real
 * InversifyJS container against the store's use-case symbol.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTicketListViewModel } from '../../src/presentation/features/support/viewmodels/createTicketListViewModel'
import { useSupportQueueViewModel } from '../../src/presentation/features/support/viewmodels/useSupportQueueViewModel'
import { useMyAssignedViewModel } from '../../src/presentation/features/support/viewmodels/useMyAssignedViewModel'
import type { SupportTicket, PaginatedResponse, AsyncResult } from '../helpers'
import { TYPES, bind, resetContainer, fakeListUseCase } from '../helpers'
import { AppError } from '../../src/core/errors/app-error'

const flush = () => new Promise((r) => setTimeout(r, 0))

function page(data: Partial<SupportTicket>[], total = data.length, pageNo = 1): PaginatedResponse<SupportTicket> {
  return {
    data: data as SupportTicket[],
    total,
    page: pageNo,
    pageSize: 20,
    hasMore: pageNo * 20 < total,
  }
}
function ok(p: PaginatedResponse<SupportTicket>): AsyncResult<PaginatedResponse<SupportTicket>> {
  return Promise.resolve({ success: true, data: p })
}

afterEach(() => resetContainer())

describe('createTicketListViewModel — load + error paths', () => {
  it('populates tickets/total/pages on success', async () => {
    const uc = fakeListUseCase(ok(page([{ ticketId: 'T1' }, { ticketId: 'T2' }], 45)))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)

    await store.getState().loadTickets()
    const s = store.getState()
    expect(s.tickets.map((t) => t.ticketId)).toEqual(['T1', 'T2'])
    expect(s.totalItems).toBe(45)
    expect(s.totalPages).toBe(3) // ceil(45/20)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })

  it('sets error message on a failed Result', async () => {
    const uc = fakeListUseCase(
      Promise.resolve({ success: false as const, error: new AppError('SERVER_ERROR' as never, 'boom') }),
    )
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    await store.getState().loadTickets()
    expect(store.getState().error).toBe('boom')
    expect(store.getState().loading).toBe(false)
  })

  it('sets a generic error when the use-case throws', async () => {
    const uc = fakeListUseCase(Promise.reject(new Error('network')))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    await store.getState().loadTickets()
    expect(store.getState().error).toBe('Failed to load tickets')
    expect(store.getState().loading).toBe(false)
  })

  it('totalPages is at least 1 when there are no results', async () => {
    const uc = fakeListUseCase(ok(page([], 0)))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    await store.getState().loadTickets()
    expect(store.getState().totalPages).toBe(1)
    expect(store.getState().totalItems).toBe(0)
  })
})

describe('createTicketListViewModel — filter emission', () => {
  it('forwards status/type/priority/merchant/search filters to the use-case', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    const st = store.getState()
    st.setStatusFilter('OPEN')
    st.setTypeFilter('BILLING')
    st.setPriorityFilter('HIGH')
    st.setMerchantFilter('MER-9')
    st.setSearchQuery('scanner')
    await flush()

    const params = uc.lastParams as { filters: Record<string, unknown>; page: number }
    expect(params.filters).toMatchObject({
      status: 'OPEN',
      type: 'BILLING',
      priority: 'HIGH',
      merchantId: 'MER-9',
      search: 'scanner',
    })
  })

  it('includes assignee/unassigned filters when includeAssigneeFilters=true', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    store.getState().setAssigneeFilter('AG-3')
    await flush()
    expect((uc.lastParams as { filters: Record<string, unknown> }).filters.assigneeId).toBe('AG-3')
  })

  it('omits empty filters (undefined, not empty strings)', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    await store.getState().loadTickets()
    const filters = (uc.lastParams as { filters: Record<string, unknown> }).filters
    expect(filters.status).toBeUndefined()
    expect(filters.search).toBeUndefined()
    expect(filters.merchantId).toBeUndefined()
  })

  it('setUnassignedOnly(true) clears any assignee filter (mutually exclusive)', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    store.getState().setAssigneeFilter('AG-3')
    store.getState().setUnassignedOnly(true)
    await flush()
    expect(store.getState().assigneeFilter).toBe('')
    expect(store.getState().unassignedOnly).toBe(true)
    expect((uc.lastParams as { filters: Record<string, unknown> }).filters.unassigned).toBe(true)
  })

  it('setAssigneeFilter clears unassignedOnly (mutually exclusive)', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    store.getState().setUnassignedOnly(true)
    store.getState().setAssigneeFilter('AG-3')
    await flush()
    expect(store.getState().unassignedOnly).toBe(false)
    expect(store.getState().assigneeFilter).toBe('AG-3')
  })
})

describe('createTicketListViewModel — pagination + filter helpers', () => {
  it('changing a filter resets currentPage to 1', async () => {
    const uc = fakeListUseCase(ok(page([], 0, 1)))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    store.setState({ currentPage: 4 })
    store.getState().setStatusFilter('RESOLVED')
    expect(store.getState().currentPage).toBe(1)
    await flush()
  })

  it('setCurrentPage requests that page from the use-case', async () => {
    const uc = fakeListUseCase(ok(page([], 100, 3)))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    store.getState().setCurrentPage(3)
    await flush()
    expect((uc.lastParams as { page: number }).page).toBe(3)
  })

  it('setPageSize resets to page 1 and recomputes totalPages', async () => {
    const uc = fakeListUseCase(ok(page([], 50, 1)))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    store.getState().setPageSize(10)
    await flush()
    expect(store.getState().pageSize).toBe(10)
    expect(store.getState().currentPage).toBe(1)
    expect(store.getState().totalPages).toBe(5) // ceil(50/10)
  })

  it('hasActiveFilters reflects any set filter and resetFilters clears them', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    const store = createTicketListViewModel(TYPES.GetSupportTicketsUseCase, true)
    expect(store.getState().hasActiveFilters()).toBe(false)
    store.getState().setStatusFilter('OPEN')
    expect(store.getState().hasActiveFilters()).toBe(true)
    store.getState().resetFilters()
    await flush()
    const s = store.getState()
    expect(s.statusFilter).toBe('')
    expect(s.searchQuery).toBe('')
    expect(s.merchantFilter).toBe('')
    expect(s.hasActiveFilters()).toBe(false)
  })
})

describe('exported store wiring — queue vs myAssigned', () => {
  const resetStore = (store: typeof useSupportQueueViewModel) =>
    store.setState({
      searchQuery: '',
      statusFilter: '',
      typeFilter: '',
      priorityFilter: '',
      merchantFilter: '',
      assigneeFilter: '',
      unassignedOnly: false,
      currentPage: 1,
      tickets: [],
    })

  beforeEach(() => {
    resetStore(useSupportQueueViewModel)
    resetStore(useMyAssignedViewModel)
  })

  it('queue store EMITS assignee/unassigned filters (includeAssigneeFilters=true)', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetSupportTicketsUseCase, uc)
    useSupportQueueViewModel.getState().setUnassignedOnly(true)
    await flush()
    expect((uc.lastParams as { filters: Record<string, unknown> }).filters.unassigned).toBe(true)
  })

  it('myAssigned store DROPS assignee/unassigned filters (self-scoped server-side)', async () => {
    const uc = fakeListUseCase(ok(page([])))
    bind(TYPES.GetMyAssignedTicketsUseCase, uc)
    // Force the fields in state, then load — the store must not forward them.
    useMyAssignedViewModel.setState({ assigneeFilter: 'AG-3', unassignedOnly: true })
    await useMyAssignedViewModel.getState().loadTickets()
    const filters = (uc.lastParams as { filters: Record<string, unknown> }).filters
    expect(filters.assigneeId).toBeUndefined()
    expect(filters.unassigned).toBeUndefined()
  })
})
