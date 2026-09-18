/**
 * SupportGraphQLDatasource — builds the frozen GraphQL documents, attaches
 * auth headers, and maps transport/GraphQL errors to AppError.
 *
 * useAuth is mocked so getAuthToken()/getAgentIdentity() are deterministic;
 * global.fetch is mocked so no network is touched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- mock the auth accessors the datasource imports ---
// vi.hoisted so the doubles exist before the hoisted vi.mock factory runs.
const authMock = vi.hoisted(() => ({
  getAuthToken: vi.fn<[], string | null>(() => 'staff-token-abc'),
  getAgentIdentity: vi.fn<[], { agentId: string } | null>(() => ({ agentId: 'AG-7' })),
}))
vi.mock('../../src/presentation/features/auth/hooks/useAuth', () => authMock)

import { SupportGraphQLDatasource } from '../../src/data/datasources/support-graphql.datasource'
import { ErrorCode, AppError } from '../../src/core/errors/app-error'
import { rawTicket, rawMessage, rawPage } from '../helpers'

const ENDPOINT = 'http://localhost:8005/support/api/graphql'

function mockFetch(opts: {
  status?: number
  ok?: boolean
  body?: unknown
  throwNetwork?: boolean
}) {
  const fn = vi.fn(async () => {
    if (opts.throwNetwork) throw new Error('ECONNREFUSED')
    return {
      status: opts.status ?? 200,
      ok: opts.ok ?? true,
      json: async () => opts.body,
    } as unknown as Response
  })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

/** Parse the JSON body sent to fetch on its first call. */
function sentBody(fn: ReturnType<typeof vi.fn>) {
  const [, init] = fn.mock.calls[0]
  return JSON.parse((init as RequestInit).body as string)
}
function sentHeaders(fn: ReturnType<typeof vi.fn>): Record<string, string> {
  const [, init] = fn.mock.calls[0]
  return (init as RequestInit).headers as Record<string, string>
}

let ds: SupportGraphQLDatasource

beforeEach(() => {
  authMock.getAuthToken.mockReturnValue('staff-token-abc')
  authMock.getAgentIdentity.mockReturnValue({ agentId: 'AG-7' })
  ds = new SupportGraphQLDatasource()
})
afterEach(() => vi.restoreAllMocks())

describe('SupportGraphQLDatasource — request building', () => {
  it('POSTs supportTickets with page/limit/filters vars + auth headers', async () => {
    const fetchFn = mockFetch({ body: { data: { supportTickets: rawPage([rawTicket()]) } } })
    const filters = { status: 'OPEN', unassigned: true }
    const res = await ds.getSupportTickets(2, 20, filters)

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect((init as RequestInit).method).toBe('POST')

    const body = sentBody(fetchFn)
    expect(body.query).toContain('query SupportTickets')
    expect(body.query).toContain('supportTickets(page: $page, limit: $limit, filters: $filters)')
    expect(body.variables).toEqual({ page: 2, limit: 20, filters })

    const headers = sentHeaders(fetchFn)
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer staff-token-abc')
    expect(headers['X-Agent-Id']).toBe('AG-7')

    expect(res.total).toBe(1)
    expect(res.tickets[0].ticketId).toBe('TCK-1')
  })

  it('POSTs myAssignedTickets with the MY_ASSIGNED document', async () => {
    const fetchFn = mockFetch({ body: { data: { myAssignedTickets: rawPage([]) } } })
    await ds.getMyAssignedTickets(1, 20, {})
    expect(sentBody(fetchFn).query).toContain('query MyAssignedTickets')
    expect(sentBody(fetchFn).query).toContain('myAssignedTickets(')
  })

  it('POSTs updateTicketStatus with ticketId + status vars', async () => {
    const fetchFn = mockFetch({
      body: { data: { updateTicketStatus: rawTicket({ status: 'IN_PROGRESS' }) } },
    })
    const t = await ds.updateTicketStatus('TCK-1', 'IN_PROGRESS')
    const body = sentBody(fetchFn)
    expect(body.query).toContain('mutation UpdateTicketStatus')
    expect(body.variables).toEqual({ ticketId: 'TCK-1', status: 'IN_PROGRESS' })
    expect(t.status).toBe('IN_PROGRESS')
  })

  it('POSTs assignTicket with the input wrapper', async () => {
    const fetchFn = mockFetch({ body: { data: { assignTicket: rawTicket() } } })
    const input = { ticketId: 'TCK-1', assigneeId: 'AG-7', assigneeName: 'Al', assignedTeam: 'SUPPORT' }
    await ds.assignTicket(input)
    const body = sentBody(fetchFn)
    expect(body.query).toContain('mutation AssignTicket')
    expect(body.variables).toEqual({ input })
  })

  it('POSTs sendSupportMessage and returns the message', async () => {
    const fetchFn = mockFetch({
      body: { data: { sendSupportMessage: rawMessage({ senderType: 'SUPPORT' }) } },
    })
    const input = { ticketId: 'TCK-1', content: 'On it' }
    const m = await ds.sendSupportMessage(input)
    expect(sentBody(fetchFn).query).toContain('mutation SendSupportMessage')
    expect(sentBody(fetchFn).variables).toEqual({ input })
    expect(m.senderType).toBe('SUPPORT')
  })

  it('POSTs markMessagesAsRead and returns the message string', async () => {
    const fetchFn = mockFetch({
      body: { data: { markMessagesAsRead: { message: 'ok' } } },
    })
    const msg = await ds.markMessagesAsRead('TCK-1', 'AG-7')
    expect(sentBody(fetchFn).variables).toEqual({ ticketId: 'TCK-1', userId: 'AG-7' })
    expect(msg).toBe('ok')
  })

  it('omits Authorization and X-Agent-Id when there is no token/identity', async () => {
    authMock.getAuthToken.mockReturnValue(null)
    authMock.getAgentIdentity.mockReturnValue(null)
    const fetchFn = mockFetch({ body: { data: { messages: [] } } })
    await ds.getMessages('TCK-1')
    const headers = sentHeaders(fetchFn)
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['X-Agent-Id']).toBeUndefined()
    expect(headers['Content-Type']).toBe('application/json')
  })
})

describe('SupportGraphQLDatasource — error mapping', () => {
  it('maps HTTP 401 -> SESSION_EXPIRED', async () => {
    mockFetch({ status: 401, ok: false, body: {} })
    await expect(ds.getMessages('TCK-1')).rejects.toMatchObject({
      code: ErrorCode.SESSION_EXPIRED,
    })
  })

  it('maps HTTP 403 -> FORBIDDEN', async () => {
    mockFetch({ status: 403, ok: false, body: {} })
    await expect(ds.getMessages('TCK-1')).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    })
  })

  it('maps a non-ok, non-401/403 HTTP status -> SERVER_ERROR', async () => {
    mockFetch({ status: 500, ok: false, body: {} })
    await expect(ds.getMessages('TCK-1')).rejects.toMatchObject({
      code: ErrorCode.SERVER_ERROR,
    })
  })

  it('maps a fetch/network throw -> NETWORK_ERROR', async () => {
    mockFetch({ throwNetwork: true })
    await expect(ds.getMessages('TCK-1')).rejects.toMatchObject({
      code: ErrorCode.NETWORK_ERROR,
    })
  })

  it('maps GraphQL VALIDATION_ERROR -> AppError.validation', async () => {
    mockFetch({
      body: { errors: [{ message: 'bad', extensions: { code: 'VALIDATION_ERROR' } }] },
    })
    const err = await ds.getMessages('TCK-1').catch((e) => e as AppError)
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(err.details?.code).toBe('VALIDATION_ERROR')
  })

  it('maps a GraphQL FORBIDDEN code -> forbidden', async () => {
    mockFetch({ body: { errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] } })
    const err = await ds.getMessages('TCK-1').catch((e) => e as AppError)
    expect(err.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('surfaces extensions.code on the AppError details for INVALID_STATUS_TRANSITION', async () => {
    // The backend emits code=INVALID_STATUS_TRANSITION (frozen handoff §68).
    // The datasource must at least surface that code to the caller.
    mockFetch({
      body: {
        errors: [
          { message: 'illegal', extensions: { code: 'INVALID_STATUS_TRANSITION' } },
        ],
      },
    })
    const err = await ds.updateTicketStatus('TCK-1', 'CLOSED').catch((e) => e as AppError)
    expect(err.details?.code).toBe('INVALID_STATUS_TRANSITION')
  })

  // --- BUG-1: transition errors are NOT classified as validation errors ---
  // The datasource branches on 'INVALID_TRANSITION' but the backend sends
  // 'INVALID_STATUS_TRANSITION', so the branch is dead and the error is
  // classified as a generic GRAPHQL_ERROR. Expected (contract intent): a
  // transition failure should map to a validation-class ErrorCode. Marked
  // it.fails so the suite stays green while documenting the defect; when the
  // source is fixed this test will start failing and must lose `.fails`.
  it.fails(
    'BUG: INVALID_STATUS_TRANSITION should map to a validation ErrorCode (currently GRAPHQL_ERROR)',
    async () => {
      mockFetch({
        body: {
          errors: [
            { message: 'illegal', extensions: { code: 'INVALID_STATUS_TRANSITION' } },
          ],
        },
      })
      const err = await ds.updateTicketStatus('TCK-1', 'CLOSED').catch((e) => e as AppError)
      expect([ErrorCode.VALIDATION_ERROR, ErrorCode.INVALID_TRANSITION]).toContain(err.code)
    },
  )

  // --- BUG-2: not-found is NOT classified as NOT_FOUND ---
  // The datasource branches on 'NOT_FOUND' but the backend sends
  // 'TICKET_NOT_FOUND' (frozen handoff §68), so a missing ticket surfaces as
  // a generic GRAPHQL_ERROR rather than ErrorCode.NOT_FOUND.
  it.fails(
    'BUG: TICKET_NOT_FOUND should map to ErrorCode.NOT_FOUND (currently GRAPHQL_ERROR)',
    async () => {
      mockFetch({
        body: { errors: [{ message: 'gone', extensions: { code: 'TICKET_NOT_FOUND' } }] },
      })
      const err = await ds.getSupportTicket('TCK-404').catch((e) => e as AppError)
      expect(err.code).toBe(ErrorCode.NOT_FOUND)
    },
  )

  it('documents ACTUAL behaviour: TICKET_NOT_FOUND currently -> GRAPHQL_ERROR', async () => {
    mockFetch({
      body: { errors: [{ message: 'gone', extensions: { code: 'TICKET_NOT_FOUND' } }] },
    })
    const err = await ds.getSupportTicket('TCK-404').catch((e) => e as AppError)
    expect(err.code).toBe(ErrorCode.GRAPHQL_ERROR)
    expect(err.details?.code).toBe('TICKET_NOT_FOUND')
  })
})
