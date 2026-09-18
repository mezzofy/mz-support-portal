/**
 * Date/time formatting helpers — Support Console.
 * Uses the active i18n language for locale-aware rendering.
 */
import i18n from '../../../../i18n/config'

function localeTag(): string {
  const lng = i18n.language || 'en'
  if (lng === 'zh-CN') return 'zh-CN'
  if (lng === 'zh-TW') return 'zh-TW'
  return 'en-US'
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(localeTag(), { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(localeTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
