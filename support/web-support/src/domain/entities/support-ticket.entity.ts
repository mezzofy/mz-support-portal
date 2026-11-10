/**
 * SupportTicket Entity — Support Console
 *
 * General-usage ticket: raised by a requestor (requestorName/requestorEmail),
 * plus support-staff assignee* sparse attributes.
 * Enum values match the svc-support constants exactly (byte-compatible writes).
 */

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_USER = 'PENDING_USER',
  PENDING_MERCHANT = 'PENDING_MERCHANT',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum TicketType {
  GENERAL = 'GENERAL',
  TECHNICAL = 'TECHNICAL',
  BUG = 'BUG',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  BILLING = 'BILLING',
  ACCOUNT = 'ACCOUNT',
  SALES = 'SALES',
  MARKETING = 'MARKETING',
  HR = 'HR',
  FINANCE = 'FINANCE',
  LEGAL = 'LEGAL',
  OPERATIONS = 'OPERATIONS',
  IT = 'IT',
  PROCUREMENT = 'PROCUREMENT',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Status transition state machine — mirrors svc-tickets STATUS_TRANSITIONS
 * (constants.py). The StatusTransitionMenu shows ONLY the targets allowed
 * for the current status; the backend re-validates on updateTicketStatus.
 */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.PENDING_USER,
    TicketStatus.PENDING_MERCHANT,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.PENDING_USER]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.PENDING_MERCHANT]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS], // IN_PROGRESS = reopen
  [TicketStatus.CLOSED]: [], // terminal
  [TicketStatus.CANCELLED]: [], // terminal
}

/** Attachment shape — matches the svc-tickets GraphQL Attachment type. */
export interface Attachment {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  url: string
  uploadedAt: string
}

export interface SupportTicket {
  ticketId: string
  requestorName: string | null
  requestorEmail: string | null
  subject: string
  description: string
  type: TicketType
  status: TicketStatus
  priority: TicketPriority
  attachments: Attachment[]
  assigneeId?: string | null
  assigneeName?: string | null
  assignedTeam?: string | null
  assignedAt?: string | null
  createdAt: string
  updatedAt: string
  closedAt?: string | null
}
