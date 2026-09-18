/**
 * Mappers — raw GraphQL wire objects -> domain entities.
 */
import { describe, it, expect } from 'vitest'
import { mapSupportTicket, mapMessage } from '../../src/data/mappers/support-ticket.mapper'
import {
  TicketStatus,
  TicketType,
  TicketPriority,
} from '../../src/domain/entities/support-ticket.entity'
import { SenderType } from '../../src/domain/entities/message.entity'
import { rawTicket, rawMessage } from '../helpers'

describe('mapSupportTicket', () => {
  it('maps a full ticket including assignee* fields', () => {
    const t = mapSupportTicket(
      rawTicket({
        assigneeId: 'AG-9',
        assigneeName: 'Dana Ops',
        assignedTeam: 'SUPPORT',
        assignedAt: '2026-09-11T09:00:00Z',
        status: 'IN_PROGRESS',
        type: 'BILLING',
        priority: 'URGENT',
      }),
    )
    expect(t.ticketId).toBe('TCK-1')
    expect(t.merchantId).toBe('MER-1')
    expect(t.merchantName).toBe('Acme Coffee')
    expect(t.assigneeId).toBe('AG-9')
    expect(t.assigneeName).toBe('Dana Ops')
    expect(t.assignedTeam).toBe('SUPPORT')
    expect(t.assignedAt).toBe('2026-09-11T09:00:00Z')
    expect(t.status).toBe(TicketStatus.IN_PROGRESS)
    expect(t.type).toBe(TicketType.BILLING)
    expect(t.priority).toBe(TicketPriority.URGENT)
  })

  it('falls back merchantName -> merchantId when name is null', () => {
    const t = mapSupportTicket(rawTicket({ merchantName: null, merchantId: 'MER-XYZ' }))
    expect(t.merchantName).toBe('MER-XYZ')
  })

  it('falls back merchantName -> merchantId when name is empty string', () => {
    const t = mapSupportTicket(rawTicket({ merchantName: '', merchantId: 'MER-EMPTY' }))
    expect(t.merchantName).toBe('MER-EMPTY')
  })

  it('coerces unknown enum values to safe defaults', () => {
    const t = mapSupportTicket(
      rawTicket({ status: 'WAT', type: 'NONSENSE', priority: 'SUPER' }),
    )
    expect(t.status).toBe(TicketStatus.OPEN)
    expect(t.type).toBe(TicketType.OTHER)
    expect(t.priority).toBe(TicketPriority.MEDIUM)
  })

  it('maps attachments array (id/fileName/fileSize/fileType/url/uploadedAt)', () => {
    const t = mapSupportTicket(
      rawTicket({
        attachments: [
          {
            id: 'ATT-1',
            fileName: 'screenshot.png',
            fileSize: 20480,
            fileType: 'image/png',
            url: 'https://cdn.example/att-1.png',
            uploadedAt: '2026-09-10T08:05:00Z',
          },
        ],
      }),
    )
    expect(t.attachments).toHaveLength(1)
    expect(t.attachments[0]).toEqual({
      id: 'ATT-1',
      fileName: 'screenshot.png',
      fileSize: 20480,
      fileType: 'image/png',
      url: 'https://cdn.example/att-1.png',
      uploadedAt: '2026-09-10T08:05:00Z',
    })
  })

  it('tolerates a null attachments field (-> empty array)', () => {
    const t = mapSupportTicket(rawTicket({ attachments: null as never }))
    expect(t.attachments).toEqual([])
  })
})

describe('mapMessage', () => {
  it('maps a USER message (no merchantId on the projection)', () => {
    const m = mapMessage(rawMessage())
    expect(m.messageId).toBe('MSG-1')
    expect(m.ticketId).toBe('TCK-1')
    expect(m.senderId).toBe('USR-1')
    expect(m.senderType).toBe(SenderType.USER)
    expect(m.content).toBe('Any update on this?')
    expect(m.isRead).toBe(false)
    expect('merchantId' in m).toBe(false)
  })

  it('maps a SUPPORT message', () => {
    const m = mapMessage(rawMessage({ senderType: 'SUPPORT', senderId: 'AG-9', isRead: true }))
    expect(m.senderType).toBe(SenderType.SUPPORT)
    expect(m.isRead).toBe(true)
  })

  it('coerces an unknown senderType to SYSTEM', () => {
    const m = mapMessage(rawMessage({ senderType: 'ROBOT' }))
    expect(m.senderType).toBe(SenderType.SYSTEM)
  })

  it('tolerates a null attachments field (-> empty array)', () => {
    const m = mapMessage(rawMessage({ attachments: null as never }))
    expect(m.attachments).toEqual([])
  })
})
