/**
 * i18n parity — all three locales (en / zh-CN / zh-TW) must expose the same
 * `support.*` key tree, and every key the components reference must resolve.
 */
import { describe, it, expect } from 'vitest'
import en from '../../src/i18n/locales/en.json'
import zhCN from '../../src/i18n/locales/zh-CN.json'
import zhTW from '../../src/i18n/locales/zh-TW.json'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, key)
      : [key]
  })
}

const enKeys = flatten(en).sort()
const cnKeys = flatten(zhCN).sort()
const twKeys = flatten(zhTW).sort()

// Keys the shipped components/state actually call t() with.
const REFERENCED_KEYS = [
  'support.detail.changeStatus',
  'support.detail.terminalStatus',
  'support.detail.moveTo',
  'support.detail.reopen',
  'support.status.OPEN',
  'support.status.IN_PROGRESS',
  'support.status.PENDING_USER',
  'support.status.PENDING_MERCHANT',
  'support.status.RESOLVED',
  'support.status.CLOSED',
  'support.status.CANCELLED',
  'support.type.TECHNICAL',
  'support.type.OTHER',
  'support.priority.LOW',
  'support.priority.URGENT',
  'support.assign.title',
  'support.assign.toMe',
  'support.assign.toOther',
  'support.assign.agentId',
  'support.assign.agentName',
  'support.assign.team',
  'support.assign.confirm',
  'support.header.close',
  'support.header.team',
  'support.common.cancel',
  'support.common.saving',
  'support.chat.title',
  'support.chat.empty',
  'support.chat.senderSupport',
  'support.chat.senderUser',
  'support.chat.senderSystem',
  'support.chat.placeholder',
  'support.chat.disabledPlaceholder',
  'support.chat.send',
  'support.chat.replyHint',
  'support.queue.searchPlaceholder',
  'support.filters.status',
  'support.filters.type',
  'support.filters.priority',
  'support.filters.all',
  'support.filters.merchant',
  'support.filters.merchantPlaceholder',
  'support.filters.assignee',
  'support.filters.assigneePlaceholder',
  'support.filters.unassignedOnly',
  'support.filters.clear',
]

describe('i18n locale parity', () => {
  it('en has the referenced component keys', () => {
    const missing = REFERENCED_KEYS.filter((k) => !enKeys.includes(k))
    expect(missing).toEqual([])
  })

  it('zh-CN key set matches en exactly', () => {
    expect(cnKeys).toEqual(enKeys)
  })

  it('zh-TW key set matches en exactly', () => {
    expect(twKeys).toEqual(enKeys)
  })

  it('no locale has an empty string value', () => {
    for (const [name, obj] of [
      ['en', en],
      ['zh-CN', zhCN],
      ['zh-TW', zhTW],
    ] as const) {
      const empties = flatten(obj as Record<string, unknown>).filter((key) => {
        const val = key.split('.').reduce<unknown>((acc, seg) => (acc as Record<string, unknown>)?.[seg], obj)
        return val === ''
      })
      expect(empties, `${name} has empty values`).toEqual([])
    }
  })

  it('covers a status label for every TicketStatus enum value in all locales', () => {
    const statuses = [
      'OPEN',
      'IN_PROGRESS',
      'PENDING_USER',
      'PENDING_MERCHANT',
      'RESOLVED',
      'CLOSED',
      'CANCELLED',
    ]
    for (const keys of [enKeys, cnKeys, twKeys]) {
      for (const s of statuses) {
        expect(keys).toContain(`support.status.${s}`)
      }
    }
  })
})
