/**
 * AssignAgentDialog — assigns via onAssign(input). "Assign to me" uses the
 * signed-in agent identity; "Another agent" takes a manual id/name/team.
 *
 * useAuth reads the agent from localStorage; we seed a staff session so the
 * "me" branch has an identity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssignAgentDialog } from '../../src/presentation/features/support/components/AssignAgentDialog'
import i18n from '../../src/i18n/config'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('authToken', 'staff-token')
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 'AG-7', name: 'Al Ops', email: 'al@mezzofy.com', team: 'SUPPORT' }),
  )
})

const baseProps = {
  open: true,
  ticketId: 'TCK-1',
  onClose: vi.fn(),
  onAssign: vi.fn(),
}

describe('AssignAgentDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AssignAgentDialog {...baseProps} open={false} onAssign={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('assigns to the signed-in agent in "me" mode', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<AssignAgentDialog {...baseProps} onAssign={onAssign} />)

    // "me" is the default mode; the signed-in agent name is shown.
    expect(await screen.findByText('Al Ops')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: i18n.t('support.assign.confirm') }))

    expect(onAssign).toHaveBeenCalledWith({
      ticketId: 'TCK-1',
      assigneeId: 'AG-7',
      assigneeName: 'Al Ops',
      assignedTeam: 'SUPPORT',
    })
  })

  it('assigns to another agent by manual id in "other" mode', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<AssignAgentDialog {...baseProps} onAssign={onAssign} />)

    await user.click(screen.getByRole('button', { name: i18n.t('support.assign.toOther') }))
    await user.type(screen.getByPlaceholderText('user-...'), 'AG-99')
    await user.click(screen.getByRole('button', { name: i18n.t('support.assign.confirm') }))

    expect(onAssign).toHaveBeenCalledTimes(1)
    const arg = onAssign.mock.calls[0][0]
    expect(arg).toMatchObject({ ticketId: 'TCK-1', assigneeId: 'AG-99' })
  })

  it('disables confirm in "other" mode until an agent id is entered', async () => {
    const user = userEvent.setup()
    render(<AssignAgentDialog {...baseProps} onAssign={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: i18n.t('support.assign.toOther') }))
    expect(screen.getByRole('button', { name: i18n.t('support.assign.confirm') })).toBeDisabled()
  })

  it('shows a pending label and disables confirm while saving', () => {
    render(<AssignAgentDialog {...baseProps} pending onAssign={vi.fn()} />)
    const confirm = screen.getByRole('button', { name: i18n.t('support.common.saving') })
    expect(confirm).toBeDisabled()
  })

  it('renders a server error message', () => {
    render(<AssignAgentDialog {...baseProps} error="Assignment failed" onAssign={vi.fn()} />)
    expect(screen.getByText('Assignment failed')).toBeInTheDocument()
  })

  it('invokes onClose from the close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AssignAgentDialog {...baseProps} onClose={onClose} onAssign={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: i18n.t('support.header.close') }))
    expect(onClose).toHaveBeenCalled()
  })
})
