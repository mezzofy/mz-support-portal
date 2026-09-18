/**
 * SupportGraphQLDatasource — Support Console
 *
 * Issues the frozen svc-support GraphQL operations against
 * VITE_SUPPORT_API_URL (default http://localhost:8005/support/api/graphql).
 *
 * Auth: staff opaque Bearer token from localStorage ('authToken'), plus the
 * dev bypass header X-Agent-Id (honoured by svc-support only when
 * ENVIRONMENT=development). Returns RAW GraphQL objects; mapping to domain
 * entities happens in the mappers / repositories.
 */
import { injectable } from 'inversify'
import { AppError, ErrorCode } from '../../core/errors/app-error'
import { getAuthToken, getAgentIdentity } from '../../presentation/features/auth/hooks/useAuth'

const ENDPOINT =
  import.meta.env.VITE_SUPPORT_API_URL || 'http://localhost:8005/support/api/graphql'

// ---- Raw wire shapes (GraphQL, camelCase via strawberry auto-conversion) ----

export interface RawAttachment {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  url: string
  uploadedAt: string
}

export interface RawSupportTicket {
  ticketId: string
  merchantId: string
  merchantName: string | null
  userId: string
  type: string
  status: string
  priority: string
  subject: string
  description: string
  attachments: RawAttachment[]
  assigneeId: string | null
  assigneeName: string | null
  assignedTeam: string | null
  assignedAt: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export interface RawPaginatedSupportTickets {
  tickets: RawSupportTicket[]
  total: number
  page: number
  limit: number
}

export interface RawMessage {
  messageId: string
  ticketId: string
  senderId: string
  senderType: string
  content: string
  attachments: RawAttachment[]
  isRead: boolean
  createdAt: string
}

// ---- GraphQL documents (frozen SDL — do not add fields the SDL omits) ----

const ATTACHMENT_FIELDS = `
  id
  fileName
  fileSize
  fileType
  url
  uploadedAt
`

const SUPPORT_TICKET_FIELDS = `
  ticketId
  merchantId
  merchantName
  userId
  type
  status
  priority
  subject
  description
  attachments { ${ATTACHMENT_FIELDS} }
  assigneeId
  assigneeName
  assignedTeam
  assignedAt
  createdAt
  updatedAt
  closedAt
`

const MESSAGE_FIELDS = `
  messageId
  ticketId
  senderId
  senderType
  content
  attachments { ${ATTACHMENT_FIELDS} }
  isRead
  createdAt
`

const SUPPORT_TICKETS_QUERY = `
  query SupportTickets($page: Int!, $limit: Int!, $filters: SupportTicketFiltersInput) {
    supportTickets(page: $page, limit: $limit, filters: $filters) {
      tickets { ${SUPPORT_TICKET_FIELDS} }
      total
      page
      limit
    }
  }
`

const MY_ASSIGNED_QUERY = `
  query MyAssignedTickets($page: Int!, $limit: Int!, $filters: SupportTicketFiltersInput) {
    myAssignedTickets(page: $page, limit: $limit, filters: $filters) {
      tickets { ${SUPPORT_TICKET_FIELDS} }
      total
      page
      limit
    }
  }
`

const SUPPORT_TICKET_QUERY = `
  query SupportTicket($ticketId: String!) {
    supportTicket(ticketId: $ticketId) { ${SUPPORT_TICKET_FIELDS} }
  }
`

const MESSAGES_QUERY = `
  query Messages($ticketId: String!) {
    messages(ticketId: $ticketId) { ${MESSAGE_FIELDS} }
  }
`

const ASSIGN_TICKET_MUTATION = `
  mutation AssignTicket($input: AssignTicketInput!) {
    assignTicket(input: $input) { ${SUPPORT_TICKET_FIELDS} }
  }
`

const UPDATE_STATUS_MUTATION = `
  mutation UpdateTicketStatus($ticketId: String!, $status: String!) {
    updateTicketStatus(ticketId: $ticketId, status: $status) { ${SUPPORT_TICKET_FIELDS} }
  }
`

const SEND_MESSAGE_MUTATION = `
  mutation SendSupportMessage($input: SendSupportMessageInput!) {
    sendSupportMessage(input: $input) { ${MESSAGE_FIELDS} }
  }
`

const MARK_READ_MUTATION = `
  mutation MarkMessagesAsRead($ticketId: String!, $userId: String!) {
    markMessagesAsRead(ticketId: $ticketId, userId: $userId) { message }
  }
`

export interface SupportTicketFiltersInput {
  merchantId?: string
  status?: string
  type?: string
  priority?: string
  assigneeId?: string
  unassigned?: boolean
  search?: string
}

export interface AssignTicketInputWire {
  ticketId: string
  assigneeId: string
  assigneeName?: string
  assignedTeam?: string
}

export interface SendSupportMessageInputWire {
  ticketId: string
  content: string
  attachments?: unknown[]
}

@injectable()
export class SupportGraphQLDatasource {
  /** Core GraphQL POST. Throws AppError on network / GraphQL / auth failure. */
  private async execute<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const token = getAuthToken()
    const identity = getAgentIdentity()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    // Dev bypass — svc-support reads this only when ENVIRONMENT=development.
    if (identity?.agentId) headers['X-Agent-Id'] = identity.agentId

    let response: Response
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      })
    } catch (err) {
      throw AppError.network('Unable to reach the support service.', {
        cause: String(err),
      })
    }

    if (response.status === 401) {
      throw new AppError(ErrorCode.SESSION_EXPIRED, 'Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw AppError.forbidden('You do not have support-staff permission.')
    }
    if (!response.ok) {
      throw new AppError(ErrorCode.SERVER_ERROR, `Support service error (${response.status}).`)
    }

    let payload: { data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> }
    try {
      payload = await response.json()
    } catch (err) {
      throw AppError.graphql('Malformed response from the support service.', { cause: String(err) })
    }

    if (payload.errors && payload.errors.length > 0) {
      const first = payload.errors[0]
      const code = String(first.extensions?.code || '')
      if (code === 'FORBIDDEN' || code === 'PERMISSION_DENIED') {
        throw AppError.forbidden(first.message)
      }
      if (code === 'NOT_FOUND') {
        throw new AppError(ErrorCode.NOT_FOUND, first.message)
      }
      if (code === 'INVALID_TRANSITION' || code === 'VALIDATION_ERROR') {
        throw AppError.validation(first.message, { code })
      }
      throw AppError.graphql(first.message, { code })
    }

    if (payload.data == null) {
      throw AppError.graphql('Empty response from the support service.')
    }
    return payload.data
  }

  async getSupportTickets(
    page: number,
    limit: number,
    filters: SupportTicketFiltersInput,
  ): Promise<RawPaginatedSupportTickets> {
    const data = await this.execute<{ supportTickets: RawPaginatedSupportTickets }>(
      SUPPORT_TICKETS_QUERY,
      { page, limit, filters },
    )
    return data.supportTickets
  }

  async getMyAssignedTickets(
    page: number,
    limit: number,
    filters: SupportTicketFiltersInput,
  ): Promise<RawPaginatedSupportTickets> {
    const data = await this.execute<{ myAssignedTickets: RawPaginatedSupportTickets }>(
      MY_ASSIGNED_QUERY,
      { page, limit, filters },
    )
    return data.myAssignedTickets
  }

  async getSupportTicket(ticketId: string): Promise<RawSupportTicket> {
    const data = await this.execute<{ supportTicket: RawSupportTicket }>(SUPPORT_TICKET_QUERY, {
      ticketId,
    })
    return data.supportTicket
  }

  async getMessages(ticketId: string): Promise<RawMessage[]> {
    const data = await this.execute<{ messages: RawMessage[] }>(MESSAGES_QUERY, { ticketId })
    return data.messages
  }

  async assignTicket(input: AssignTicketInputWire): Promise<RawSupportTicket> {
    const data = await this.execute<{ assignTicket: RawSupportTicket }>(ASSIGN_TICKET_MUTATION, {
      input,
    })
    return data.assignTicket
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<RawSupportTicket> {
    const data = await this.execute<{ updateTicketStatus: RawSupportTicket }>(
      UPDATE_STATUS_MUTATION,
      { ticketId, status },
    )
    return data.updateTicketStatus
  }

  async sendSupportMessage(input: SendSupportMessageInputWire): Promise<RawMessage> {
    const data = await this.execute<{ sendSupportMessage: RawMessage }>(SEND_MESSAGE_MUTATION, {
      input,
    })
    return data.sendSupportMessage
  }

  async markMessagesAsRead(ticketId: string, userId: string): Promise<string> {
    const data = await this.execute<{ markMessagesAsRead: { message: string } }>(
      MARK_READ_MUTATION,
      { ticketId, userId },
    )
    return data.markMessagesAsRead.message
  }
}
