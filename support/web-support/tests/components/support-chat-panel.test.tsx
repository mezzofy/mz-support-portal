/**
 * SupportChatPanel — renders the thread (SUPPORT right / USER left), sends a
 * reply as SUPPORT, and loads/marks-read on mount.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SupportChatPanel } from '../../src/presentation/features/support/components/SupportChatPanel'
import { mapMessage } from '../../src/data/mappers/support-ticket.mapper'
import { rawMessage } from '../helpers'
import i18n from '../../src/i18n/config'

function baseProps(over: Partial<React.ComponentProps<typeof SupportChatPanel>> = {}) {
  return {
    ticketId: 'TCK-1',
    messages: [],
    loading: false,
    sending: false,
    onLoadMessages: vi.fn(),
    onSend: vi.fn(async () => true),
    onMarkRead: vi.fn(),
    ...over,
  }
}

const userMsg = mapMessage(rawMessage({ messageId: 'M-U', senderType: 'USER', content: 'Help please' }))
const supportMsg = mapMessage(
  rawMessage({ messageId: 'M-S', senderType: 'SUPPORT', content: 'Looking into it' }),
)

describe('SupportChatPanel', () => {
  it('loads messages on mount', () => {
    const onLoadMessages = vi.fn()
    render(<SupportChatPanel {...baseProps({ onLoadMessages })} />)
    expect(onLoadMessages).toHaveBeenCalledWith('TCK-1')
  })

  it('shows the empty state when there are no messages', () => {
    render(<SupportChatPanel {...baseProps()} />)
    expect(screen.getByText(i18n.t('support.chat.empty'))).toBeInTheDocument()
  })

  it('renders USER and SUPPORT messages with their sender labels', () => {
    render(<SupportChatPanel {...baseProps({ messages: [userMsg, supportMsg] })} />)
    expect(screen.getByText('Help please')).toBeInTheDocument()
    expect(screen.getByText('Looking into it')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('support.chat.senderUser'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('support.chat.senderSupport'))).toBeInTheDocument()
  })

  it('aligns SUPPORT messages to the right and USER to the left', () => {
    render(<SupportChatPanel {...baseProps({ messages: [userMsg, supportMsg] })} />)
    const userRow = screen.getByText('Help please').closest('.flex') as HTMLElement
    const supportRow = screen.getByText('Looking into it').closest('.flex') as HTMLElement
    expect(userRow.className).toContain('justify-start')
    expect(supportRow.className).toContain('justify-end')
  })

  it('sends a reply and clears the composer on success', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn(async () => true)
    render(<SupportChatPanel {...baseProps({ onSend })} />)
    const box = screen.getByLabelText(i18n.t('support.chat.placeholder')) as HTMLTextAreaElement
    await user.type(box, 'Resolved for you')
    await user.click(screen.getByRole('button', { name: i18n.t('support.chat.send') }))
    expect(onSend).toHaveBeenCalledWith('Resolved for you')
    expect(box.value).toBe('')
  })

  it('does not clear the composer when send fails', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn(async () => false)
    render(<SupportChatPanel {...baseProps({ onSend })} />)
    const box = screen.getByLabelText(i18n.t('support.chat.placeholder')) as HTMLTextAreaElement
    await user.type(box, 'try again')
    await user.click(screen.getByRole('button', { name: i18n.t('support.chat.send') }))
    expect(onSend).toHaveBeenCalled()
    expect(box.value).toBe('try again')
  })

  it('keeps send disabled for whitespace-only drafts', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn(async () => true)
    render(<SupportChatPanel {...baseProps({ onSend })} />)
    await user.type(screen.getByLabelText(i18n.t('support.chat.placeholder')), '   ')
    expect(screen.getByRole('button', { name: i18n.t('support.chat.send') })).toBeDisabled()
  })

  it('disables the composer when disabled (closed ticket)', () => {
    render(<SupportChatPanel {...baseProps({ disabled: true })} />)
    expect(screen.getByLabelText(i18n.t('support.chat.placeholder'))).toBeDisabled()
  })

  it('renders an action error above the composer', () => {
    render(<SupportChatPanel {...baseProps({ actionError: 'Send failed' })} />)
    expect(screen.getByText('Send failed')).toBeInTheDocument()
  })
})
