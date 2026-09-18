/**
 * StatusTransitionMenu — the client mirror of the status state-machine. It must
 * offer ONLY the targets STATUS_TRANSITIONS allows for the current status, and
 * present terminal states (CLOSED/CANCELLED) with no options.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusTransitionMenu } from '../../src/presentation/features/support/components/StatusTransitionMenu'
import {
  STATUS_TRANSITIONS,
  TicketStatus,
} from '../../src/domain/entities/support-ticket.entity'
import i18n from '../../src/i18n/config'

const label = (s: TicketStatus) => i18n.t(`support.status.${s}`)

const NON_TERMINAL = Object.values(TicketStatus).filter(
  (s) => STATUS_TRANSITIONS[s].length > 0,
)
const TERMINAL = Object.values(TicketStatus).filter(
  (s) => STATUS_TRANSITIONS[s].length === 0,
)

describe('StatusTransitionMenu', () => {
  it.each(NON_TERMINAL)('offers exactly the allowed targets for %s', async (status) => {
    const user = userEvent.setup()
    render(<StatusTransitionMenu currentStatus={status} onSelect={vi.fn()} />)
    await user.click(screen.getByRole('button'))

    const menu = screen.getByRole('menu')
    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(STATUS_TRANSITIONS[status].length)

    const shownLabels = items.map((el) => el.textContent || '')
    for (const target of STATUS_TRANSITIONS[status]) {
      expect(shownLabels.some((txt) => txt.includes(label(target)))).toBe(true)
    }
  })

  it.each(TERMINAL)('renders %s as terminal with a disabled trigger and no menu', (status) => {
    render(<StatusTransitionMenu currentStatus={status} onSelect={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('support.detail.terminalStatus'))).toBeInTheDocument()
  })

  it('calls onSelect with the chosen target and closes the menu', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<StatusTransitionMenu currentStatus={TicketStatus.OPEN} onSelect={onSelect} />)
    await user.click(screen.getByRole('button'))
    // OPEN -> [IN_PROGRESS, CANCELLED]; pick IN_PROGRESS.
    await user.click(screen.getByRole('menuitem', { name: new RegExp(label(TicketStatus.IN_PROGRESS)) }))
    expect(onSelect).toHaveBeenCalledWith(TicketStatus.IN_PROGRESS)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('shows the reopen hint on RESOLVED -> IN_PROGRESS', async () => {
    const user = userEvent.setup()
    render(<StatusTransitionMenu currentStatus={TicketStatus.RESOLVED} onSelect={vi.fn()} />)
    await user.click(screen.getByRole('button'))
    const item = screen.getByRole('menuitem', { name: new RegExp(label(TicketStatus.IN_PROGRESS)) })
    expect(item.textContent).toContain(i18n.t('support.detail.reopen'))
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    render(<StatusTransitionMenu currentStatus={TicketStatus.OPEN} disabled onSelect={vi.fn()} />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
