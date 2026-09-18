/**
 * STATUS_TRANSITIONS state-machine — mirrors the svc-tickets transition map
 * frozen in the backend->frontend handoff (§Behaviour notes, 7-state).
 */
import { describe, it, expect } from 'vitest'
import {
  STATUS_TRANSITIONS,
  TicketStatus,
} from '../../src/domain/entities/support-ticket.entity'

// The authoritative map from the frozen handoff.
const EXPECTED: Record<TicketStatus, TicketStatus[]> = {
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
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
  [TicketStatus.CANCELLED]: [],
}

describe('STATUS_TRANSITIONS', () => {
  it('defines the 7 canonical statuses', () => {
    expect(Object.keys(TicketStatus)).toHaveLength(7)
    expect(Object.keys(STATUS_TRANSITIONS).sort()).toEqual(
      Object.values(TicketStatus).sort(),
    )
  })

  it.each(Object.values(TicketStatus))('matches the frozen map for %s', (status) => {
    expect(STATUS_TRANSITIONS[status]).toEqual(EXPECTED[status])
  })

  it('marks CLOSED and CANCELLED terminal (no outgoing transitions)', () => {
    expect(STATUS_TRANSITIONS[TicketStatus.CLOSED]).toHaveLength(0)
    expect(STATUS_TRANSITIONS[TicketStatus.CANCELLED]).toHaveLength(0)
  })

  it('allows RESOLVED -> IN_PROGRESS (reopen) and RESOLVED -> CLOSED', () => {
    expect(STATUS_TRANSITIONS[TicketStatus.RESOLVED]).toContain(TicketStatus.IN_PROGRESS)
    expect(STATUS_TRANSITIONS[TicketStatus.RESOLVED]).toContain(TicketStatus.CLOSED)
  })

  it('auto-advance target OPEN -> IN_PROGRESS is a legal transition', () => {
    // assignTicket auto-advances OPEN to IN_PROGRESS; the map must permit it.
    expect(STATUS_TRANSITIONS[TicketStatus.OPEN]).toContain(TicketStatus.IN_PROGRESS)
  })

  it('never lists a status as its own transition target', () => {
    for (const status of Object.values(TicketStatus)) {
      expect(STATUS_TRANSITIONS[status]).not.toContain(status)
    }
  })
})
