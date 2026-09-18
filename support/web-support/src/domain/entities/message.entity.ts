/**
 * Message Entity — Support Console
 * Matches the frozen svc-support Message type (no merchantId on the wire).
 */
import type { Attachment } from './support-ticket.entity'

export enum SenderType {
  USER = 'USER',
  SUPPORT = 'SUPPORT',
  SYSTEM = 'SYSTEM',
}

export interface Message {
  messageId: string
  ticketId: string
  senderId: string
  senderType: SenderType
  content: string
  attachments: Attachment[]
  isRead: boolean
  createdAt: string
}
