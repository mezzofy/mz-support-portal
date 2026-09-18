/**
 * Mappers — raw GraphQL objects -> domain entities. Support Console.
 */
import {
  TicketStatus,
  TicketType,
  TicketPriority,
  type SupportTicket,
  type Attachment,
} from '../../domain/entities/support-ticket.entity'
import { SenderType, type Message } from '../../domain/entities/message.entity'
import type {
  RawAttachment,
  RawSupportTicket,
  RawMessage,
} from '../datasources/support-graphql.datasource'

function mapAttachment(raw: RawAttachment): Attachment {
  return {
    id: raw.id,
    fileName: raw.fileName,
    fileSize: raw.fileSize,
    fileType: raw.fileType,
    url: raw.url,
    uploadedAt: raw.uploadedAt,
  }
}

/** Coerce a wire string into an enum, falling back to a safe default. */
function toEnum<T extends Record<string, string>>(
  enumObj: T,
  value: string,
  fallback: T[keyof T],
): T[keyof T] {
  return (Object.values(enumObj) as string[]).includes(value)
    ? (value as T[keyof T])
    : fallback
}

export function mapSupportTicket(raw: RawSupportTicket): SupportTicket {
  return {
    ticketId: raw.ticketId,
    merchantId: raw.merchantId,
    merchantName: raw.merchantName || raw.merchantId,
    userId: raw.userId,
    subject: raw.subject,
    description: raw.description,
    type: toEnum(TicketType, raw.type, TicketType.OTHER),
    status: toEnum(TicketStatus, raw.status, TicketStatus.OPEN),
    priority: toEnum(TicketPriority, raw.priority, TicketPriority.MEDIUM),
    attachments: (raw.attachments || []).map(mapAttachment),
    assigneeId: raw.assigneeId,
    assigneeName: raw.assigneeName,
    assignedTeam: raw.assignedTeam,
    assignedAt: raw.assignedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    closedAt: raw.closedAt,
  }
}

export function mapMessage(raw: RawMessage): Message {
  return {
    messageId: raw.messageId,
    ticketId: raw.ticketId,
    senderId: raw.senderId,
    senderType: toEnum(SenderType, raw.senderType, SenderType.SYSTEM),
    content: raw.content,
    attachments: (raw.attachments || []).map(mapAttachment),
    isRead: raw.isRead,
    createdAt: raw.createdAt,
  }
}
