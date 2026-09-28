/**
 * NewTicketDialog — staff ticket-intake form. Validates the create path:
 * hidden when closed, submit gated on required fields, and onCreate receives
 * the trimmed payload with the type/priority defaults.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewTicketDialog } from '../../src/presentation/features/support/components/NewTicketDialog'
import i18n from '../../src/i18n/config'

const confirmName = i18n.t('support.createTicket.confirm')

describe('NewTicketDialog', () => {
  it('renders nothing when closed', () => {
    render(<NewTicketDialog open={false} onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps submit disabled until required fields are valid', async () => {
    const user = userEvent.setup()
    render(<NewTicketDialog open onClose={vi.fn()} onCreate={vi.fn()} />)
    const submit = screen.getByRole('button', { name: confirmName })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/merchant id/i), 'm_acme')
    await user.type(screen.getByLabelText(/subject/i), 'ab') // too short (<3)
    await user.type(screen.getByLabelText(/description/i), 'short') // too short (<10)
    expect(submit).toBeDisabled()
  })

  it('submits the trimmed payload with type/priority defaults', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<NewTicketDialog open onClose={vi.fn()} onCreate={onCreate} />)

    await user.type(screen.getByLabelText(/merchant id/i), 'm_acme')
    await user.type(screen.getByLabelText(/merchant name/i), 'Acme Retail')
    await user.type(screen.getByLabelText(/subject/i), 'Cannot pay')
    await user.type(screen.getByLabelText(/description/i), 'The invoice fails to load repeatedly.')

    const submit = screen.getByRole('button', { name: confirmName })
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith({
      merchantId: 'm_acme',
      merchantName: 'Acme Retail',
      type: 'GENERAL',
      priority: 'MEDIUM',
      subject: 'Cannot pay',
      description: 'The invoice fails to load repeatedly.',
    })
  })

  it('calls onClose from the cancel button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<NewTicketDialog open onClose={onClose} onCreate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: i18n.t('support.common.cancel') }))
    expect(onClose).toHaveBeenCalled()
  })
})
